import { ErrorTypes } from '@core/errors/app-error.js'
import type { IInventoryModuleService } from '@core/types/inventory/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

type CancelOrderInput = { orderId: string }

export const cancelOrderWorkflow = createWorkflow<CancelOrderInput, OrderDTO>('cancel-order', async (ctx, input) => {
  await ctx.step('validate-guards', async ({ container }) => {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const order = await orderService.retrieveOrder(input.orderId)

    if (order.status !== 'pending') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cannot cancel order ${input.orderId}: status is "${order.status}", expected "pending"`,
      })
    }

    if (order.fulfillmentStatus !== 'unfulfilled') {
      throw new WorkflowTerminalError({
        type: ErrorTypes.NOT_ALLOWED,
        message: `Cannot cancel order ${input.orderId}: fulfillment status is "${order.fulfillmentStatus}", expected "unfulfilled"`,
      })
    }
  })

  await ctx.step('delete-reservations', async ({ container }) => {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    const inventoryService = container.resolve<IInventoryModuleService>(Modules.INVENTORY)

    const lineItems = await orderService.listOrderLineItems({ orderId: input.orderId })
    const lineItemIds = lineItems.map((item) => item.id)

    if (lineItemIds.length === 0) return

    const reservations = await inventoryService.listReservationItems({ lineItemId: lineItemIds })
    if (reservations.length === 0) return

    await inventoryService.deleteReservationItems(reservations.map((reservation) => reservation.id))
  })

  const canceled = await ctx.step('cancel-order', async ({ container }) => {
    const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
    return orderService.cancelOrder(input.orderId)
  })

  return canceled
})
