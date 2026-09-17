import { ErrorTypes } from '@core/errors/app-error.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { computeFulfillmentStatus } from './utils/compute-fulfillment-status.js'

type MarkOrderDeliveredInput = {
  orderId: string
  fulfillmentId: string
}

// Final fulfillment lifecycle step: shipped -> delivered. Records the delivery timestamp
// on the fulfillment and advances the order to its terminal fulfillment state.
export const markOrderDeliveredWorkflow = createWorkflow<MarkOrderDeliveredInput, OrderDTO>(
  { name: 'mark-order-delivered', throws: [ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] },
  async (ctx, input) => {
    // Only shipped orders can be marked delivered, and the fulfillment must belong to this order.
    await ctx.step('validate-guards', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status === 'canceled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot mark order ${input.orderId} as delivered: order is canceled`,
        })
      }

      const link = await linkService.repo('orderFulfillment').findByFulfillmentId(input.fulfillmentId)

      if (!link || link.orderId !== input.orderId) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: `Fulfillment ${input.fulfillmentId} is not linked to order ${input.orderId}`,
        })
      }

      const fulfillment = await fulfillmentService.retrieveFulfillment(input.fulfillmentId)
      const status = computeFulfillmentStatus([fulfillment])

      if (status !== 'shipped') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot mark order ${input.orderId} as delivered: fulfillment status is "${status}", expected "shipped"`,
        })
      }
    })

    // Stamp the fulfillment with a deliveredAt date. Same pattern as shipment —
    // the fulfillment module uses date fields rather than dedicated lifecycle methods.
    await ctx.step(
      'mark-delivered',
      async ({ container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { deliveredAt: new Date() })
      },
      async (_output, { container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { deliveredAt: null })
      },
    )

    return ctx.step('retrieve-order', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      return orderService.retrieveOrder(input.orderId)
    })
  },
)
