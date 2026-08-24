import { ErrorTypes } from '@core/errors/app-error.js'
import type { CreateFulfillmentDTO } from '@core/types/fulfillment/mutations.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ReservationItemDTO } from '@core/types/inventory/common.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { computeInventoryAdjustments } from './utils/compute-inventory-adjustments.js'

type CreateOrderFulfillmentInput = {
  orderId: string
  fulfillmentData: CreateFulfillmentDTO
  locationId: string
}

// Drives an order from unfulfilled -> fulfilled. Creates the physical fulfillment record,
// links it to the order, then converts reservations into actual stock decrements (the items
// are leaving the warehouse, so reserved stock becomes consumed stock).
export const createOrderFulfillmentWorkflow = createWorkflow<CreateOrderFulfillmentInput, OrderDTO>(
  'create-order-fulfillment',
  async (ctx, input) => {
    /** Gate on order lifecycle state — only pending, unfulfilled orders may enter
     *  the fulfillment flow. Prevents double-fulfillment and fulfilling canceled orders. */
    await ctx.step('validate-guards', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status !== 'pending') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot fulfill order ${input.orderId}: status is "${order.status}", expected "pending"`,
        })
      }

      if (order.fulfillmentStatus !== 'unfulfilled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot fulfill order ${input.orderId}: fulfillment status is "${order.fulfillmentStatus}", expected "unfulfilled"`,
        })
      }
    })

    /** Validate fulfillment data against the order before creating any resources.
     *  Rejects requests that reference non-existent line items or orders whose items
     *  have mixed shipping requirements (shippable + non-shippable in one fulfillment). */
    await ctx.step('validate-fulfillment-items', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const lineItemIds = new Set(lineItems.map((item) => item.id))

      for (const item of input.fulfillmentData.items) {
        if (item.lineItemId != null && !lineItemIds.has(item.lineItemId)) {
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_ALLOWED,
            message: `Fulfillment item references line item "${item.lineItemId}" which does not exist in order ${input.orderId}`,
          })
        }
      }

      const shippingRequirements = new Set(lineItems.map((item) => item.requiresShipping))
      if (shippingRequirements.size > 1) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Order ${input.orderId} contains items with mixed shipping requirements`,
        })
      }
    })

    /** Create the fulfillment record in the fulfillment module (items, address, provider).
     *  Compensates by canceling the fulfillment if a later step fails. */
    const fulfillment = await ctx.step(
      'create-fulfillment',
      async ({ container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        return fulfillmentService.createFulfillment(input.fulfillmentData)
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

    /** Advance the order's fulfillment status so downstream workflows (shipment,
     *  delivery) can gate on the correct state. Compensates back to "unfulfilled". */
    const updated = await ctx.step(
      'update-fulfillment-status',
      async ({ container }) => {
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        return orderService.updateFulfillmentStatus(input.orderId, 'fulfilled')
      },
      async (_output, { container }) => {
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        await orderService.updateFulfillmentStatus(input.orderId, 'unfulfilled')
      },
    )

    /** Items are physically leaving the warehouse — convert reservations into stock
     *  decrements. For managed-inventory variants, the deduction is computed as
     *  lineItemQty × requiredQuantity (from the variant-inventory link). Throws if
     *  a managed item is missing a reservation or the reservation is insufficient.
     *  Compensates by reversing inventory adjustments and restoring reservations. */
    await ctx.step(
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

    return updated
  },
)
