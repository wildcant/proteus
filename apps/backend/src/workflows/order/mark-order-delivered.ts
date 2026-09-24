import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
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
      const orderService = container.resolve(Modules.ORDER)
      const fulfillmentService = container.resolve(Modules.FULFILLMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status === 'canceled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot mark order {orderId} as delivered: order is canceled'),
          values: { orderId: input.orderId },
        })
      }

      const link = await linkService.repo('orderFulfillment').findByFulfillmentId(input.fulfillmentId)

      if (!link || link.orderId !== input.orderId) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: i18n.t('Fulfillment {fulfillmentId} is not linked to order {orderId}'),
          values: { fulfillmentId: input.fulfillmentId, orderId: input.orderId },
        })
      }

      const fulfillment = await fulfillmentService.retrieveFulfillment(input.fulfillmentId)

      // Checked before the status: a canceled fulfillment computes as "unfulfilled", which
      // would report a state the admin never put it in.
      if (fulfillment.canceledAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cannot mark order {orderId} as delivered: fulfillment is canceled'),
          values: { orderId: input.orderId },
        })
      }

      const status = computeFulfillmentStatus([fulfillment])

      if (status !== 'shipped') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t(
            'Cannot mark order {orderId} as delivered: fulfillment status is "{status}", expected "shipped"',
          ),
          values: { orderId: input.orderId, status },
        })
      }
    })

    // Stamp the fulfillment with a deliveredAt date. Same pattern as shipment —
    // the fulfillment module uses date fields rather than dedicated lifecycle methods.
    await ctx.step(
      'mark-delivered',
      async ({ container }) => {
        const fulfillmentService = container.resolve(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { deliveredAt: new Date() })
      },
      async (_output, { container }) => {
        const fulfillmentService = container.resolve(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { deliveredAt: null })
      },
    )

    return ctx.step('retrieve-order', async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      return orderService.retrieveOrder(input.orderId)
    })
  },
)
