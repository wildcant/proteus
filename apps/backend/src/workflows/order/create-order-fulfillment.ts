import { ErrorTypes } from '@core/errors/app-error.js'
import type { EventBus } from '@core/event-bus/types.js'
import type { CreateFulfillmentDTO } from '@core/types/fulfillment/mutations.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ReservationItemDTO } from '@core/types/inventory/common.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { computeFulfillmentStatus } from './utils/compute-fulfillment-status.js'
import { computeInventoryAdjustments } from './utils/compute-inventory-adjustments.js'

type CreateOrderFulfillmentInput = {
  orderId: string
  fulfillmentData: CreateFulfillmentDTO
}

// Drives an order from unfulfilled -> fulfilled. Creates the physical fulfillment record,
// links it to the order, then converts reservations into actual stock decrements (the items
// are leaving the warehouse, so reserved stock becomes consumed stock).
export const createOrderFulfillmentWorkflow = createWorkflow<CreateOrderFulfillmentInput, OrderDTO>(
  { name: 'create-order-fulfillment', throws: [ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => {
    /** Gate on order lifecycle state — only pending, unfulfilled orders may enter
     *  the fulfillment flow. Prevents double-fulfillment and fulfilling canceled orders. */
    await ctx.step('validate-guards', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status !== 'pending') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot fulfill order ${input.orderId}: status is "${order.status}", expected "pending"`,
        })
      }

      const link = await linkService.repo('orderFulfillment').findByOrderId(input.orderId)
      const fulfillments = link ? [await fulfillmentService.retrieveFulfillment(link.fulfillmentId)] : []
      const status = computeFulfillmentStatus(fulfillments)

      if (status !== 'unfulfilled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot fulfill order ${input.orderId}: fulfillment status is "${status}", expected "unfulfilled"`,
        })
      }
    })

    /** Validate fulfillment data against the order before creating any resources.
     *
     *  Whole order or nothing. The steps below de-reserve and adjust *every* line item on the order
     *  and mark the whole order fulfilled, whatever subset was asked for — so a request covering
     *  part of it, accepted, would be reported back as a fulfillment of all of it. Medusa's partial
     *  semantics (deduct the requested quantity, reduce the reservation, delete it only at zero) are
     *  a separate piece of work, and half of them — a correctly reduced reservation on an order
     *  marked fully fulfilled — is worse than none.
     *
     *  Also rejects orders whose items have mixed shipping requirements (shippable and
     *  non-shippable in one fulfillment). */
    await ctx.step('validate-fulfillment-items', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const lineItemIds = new Set(lineItems.map((item) => item.id))

      const requested = new Map<string, number>()
      for (const item of input.fulfillmentData.items) {
        if (item.lineItemId == null) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: `Fulfillment item "${item.title}" names no line item of order ${input.orderId}`,
          })
        }

        if (!lineItemIds.has(item.lineItemId)) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: `Fulfillment item references line item "${item.lineItemId}" which does not exist in order ${input.orderId}`,
          })
        }

        requested.set(item.lineItemId, (requested.get(item.lineItemId) ?? 0) + item.quantity)
      }

      const uncovered = lineItems.filter((item) => (requested.get(item.id) ?? 0) !== item.quantity)
      if (uncovered.length > 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Fulfillment for order ${input.orderId} must cover every line item at its full quantity: ${uncovered
            .map((item) => `"${item.id}" asked for ${requested.get(item.id) ?? 0} of ${item.quantity}`)
            .join('; ')}`,
        })
      }

      const shippingRequirements = new Set(lineItems.map((item) => item.requiresShipping))
      if (shippingRequirements.size > 1) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Order ${input.orderId} contains items with mixed shipping requirements`,
        })
      }
    })

    /** Where the units actually leave from, which is what the fulfillment record's `locationId`
     *  claims to anyone reading it afterwards.
     *
     *  A reservation can only be written where a level exists, so the location its rows name is the
     *  only one that can hold this order's stock. That is why the payload's `locationId` is optional
     *  and resolved from the reservations when it is absent, and why one that disagrees with them is
     *  refused rather than stamped on a record the stock never left. Medusa instead falls back
     *  through the shipping option's fulfillment set to a linked Stock Location; that link exists to
     *  decide *which* location ships, a question one location does not raise. */
    const locationId = await ctx.step('resolve-fulfillment-location', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const reservations =
        lineItems.length > 0
          ? await inventoryService.listReservationItems({ lineItemId: lineItems.map((item) => item.id) })
          : []
      const held = [...new Set(reservations.map((reservation) => reservation.locationId))]

      const requested = input.fulfillmentData.locationId
      if (requested == null) {
        // Unreachable while the shop has one location. A second one makes this the caller's choice,
        // and guessing it would put a location on the record the shopkeeper never picked.
        if (held.length > 1) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: `Order ${input.orderId} reserves stock at more than one location (${held.join(', ')}), so the fulfillment has to name the one it ships from`,
          })
        }

        return held[0] ?? null
      }

      const elsewhere = held.filter((location) => location !== requested)
      if (elsewhere.length > 0) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot fulfill order ${input.orderId} from location "${requested}": its stock is reserved at ${elsewhere
            .map((location) => `"${location}"`)
            .join(', ')}`,
        })
      }

      return requested
    })

    /** Create the fulfillment record in the fulfillment module (items, address, provider).
     *  Compensates by canceling the fulfillment if a later step fails. */
    const fulfillment = await ctx.step(
      'create-fulfillment',
      async ({ container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        return fulfillmentService.createFulfillment({ ...input.fulfillmentData, locationId, packedAt: new Date() })
      },
      async (created, { container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        await fulfillmentService.cancelFulfillment(created.id)
      },
    )

    /** Bridge the fulfillment and order modules via a cross-module link table — the
     *  fulfillment module owns the record, but the order module needs to know which
     *  fulfillment belongs to which order. Compensates by dismissing the link. */
    await ctx.step(
      'link-order-fulfillment',
      async ({ container }) => {
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        await linkService.repo('orderFulfillment').create({ orderId: input.orderId, fulfillmentId: fulfillment.id })
      },
      async (_output, { container }) => {
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
        await linkService.dismissLinks({ fulfillmentId: [fulfillment.id] })
      },
    )

    /** Items are physically leaving the warehouse — convert reservations into stock
     *  decrements. For managed-inventory variants, the deduction is computed as
     *  lineItemQty × requiredQuantity (from the variant-inventory link). Throws if
     *  a managed item is missing a reservation or the reservation is insufficient.
     *  Compensates by reversing inventory adjustments and restoring reservations. */
    const adjusted = await ctx.step(
      'adjust-inventory',
      async ({ container }) => {
        const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)

        const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
        if (lineItems.length === 0) return { adjustments: [], reservationIdsToDelete: [] }

        const variantIds = lineItems.map((item) => item.variantId).filter((id): id is string => id !== null)
        const variantInventoryLinks =
          variantIds.length > 0
            ? await linkService.repo('productVariantInventoryItem').findByVariantIds(variantIds)
            : []
        const variantInventoryMap = new Map(variantInventoryLinks.map((link) => [link.variantId, link]))

        const lineItemIds = lineItems.map((item) => item.id)
        const reservations = await inventoryService.listReservationItems({ lineItemId: lineItemIds })
        const reservationsByLineItem = new Map<string, ReservationItemDTO>()
        for (const reservation of reservations) {
          if (reservation.lineItemId !== null) {
            reservationsByLineItem.set(reservation.lineItemId, reservation)
          }
        }

        const result = computeInventoryAdjustments(lineItems, variantInventoryMap, reservationsByLineItem)

        await Promise.all(
          result.adjustments.map((adjustment) =>
            inventoryService.adjustInventoryLevel(
              adjustment.inventoryItemId,
              adjustment.locationId,
              adjustment.quantity,
            ),
          ),
        )

        if (result.reservationIdsToDelete.length > 0) {
          await inventoryService.softDeleteReservationItems(result.reservationIdsToDelete)
        }

        return result
      },
      async (result, { container }) => {
        if (!result || (result.adjustments.length === 0 && result.reservationIdsToDelete.length === 0)) return

        const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

        // Reverse inventory adjustments (add back what was deducted)
        await Promise.all(
          result.adjustments.map((adjustment) =>
            inventoryService.adjustInventoryLevel(
              adjustment.inventoryItemId,
              adjustment.locationId,
              -adjustment.quantity,
            ),
          ),
        )

        // Restore soft-deleted reservations
        if (result.reservationIdsToDelete.length > 0) {
          await inventoryService.restoreReservationItems(result.reservationIdsToDelete)
        }
      },
    )

    /** Fulfillment is the second of the three ways stock moves down, and the last step is where it
     *  is announced — an emit inside `adjust-inventory` would already be gone by the time a
     *  failure below it compensated the adjustment away.
     *
     *  Published for every level the adjustment touched, without asking whether Available Quantity
     *  actually fell: taking units off the shelf and releasing their reservation move stocked and
     *  reserved by the same amount, so what changed is which number holds them. Whether that is
     *  worth telling anyone about is `alert-low-stock`'s single comparison to make. */
    await ctx.step('publish-available-decreased', async ({ container }) => {
      if (adjusted.adjustments.length === 0) return

      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      const bus = container.resolve<EventBus>(ContainerRegistrationKeys.EVENT_BUS)

      const levels = await inventoryService.listInventoryLevels({
        inventoryItemId: adjusted.adjustments.map((adjustment) => adjustment.inventoryItemId),
      })
      const touched = levels.filter((level) =>
        adjusted.adjustments.some(
          (adjustment) =>
            adjustment.inventoryItemId === level.inventoryItemId && adjustment.locationId === level.locationId,
        ),
      )

      await Promise.all(
        touched.map((level) =>
          bus.emit('inventory.available_decreased', {
            id: level.id,
            version: level.version,
            stockedQuantity: level.stockedQuantity,
            reservedQuantity: level.reservedQuantity,
          }),
        ),
      )
    })

    return ctx.step('retrieve-order', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      return orderService.retrieveOrder(input.orderId)
    })
  },
)
