import { ErrorTypes } from '@core/errors/app-error.js'
import type { CreateFulfillmentDTO } from '@core/types/fulfillment/mutations.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

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
    // Only pending orders that haven't been fulfilled yet can enter the fulfillment flow.
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

    // Create the fulfillment record in the fulfillment module (items, address, provider).
    // Compensates by canceling the fulfillment if a later step fails.
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

    // Cross-module join: the fulfillment module owns the fulfillment, but the order module
    // needs to know which fulfillment belongs to which order. The link table bridges them.
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

    // Transition the order's fulfillment status so downstream steps (shipment, delivery)
    // can gate on the correct state.
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

    // Items are physically leaving the warehouse: deduct the reserved quantities from
    // stocked inventory, then delete the reservations since they've been consumed.
    // No compensation — inventory adjustments are best-effort at this point; the
    // fulfillment is already created and the order status updated.
    await ctx.step('adjust-inventory', async ({ container }) => {
      const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)

      const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
      const lineItemIds = lineItems.map((item) => item.id)

      if (lineItemIds.length === 0) return

      const reservations = await inventoryService.listReservationItems({ lineItemId: lineItemIds })

      await Promise.all(
        reservations.map((reservation) =>
          inventoryService.adjustInventoryLevel(
            reservation.inventoryItemId,
            reservation.locationId,
            -reservation.quantity,
          ),
        ),
      )

      if (reservations.length > 0) {
        await inventoryService.deleteReservationItems(reservations.map((reservation) => reservation.id))
      }
    })

    return updated
  },
)
