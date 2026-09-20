import { ErrorTypes } from '@core/errors/app-error.js'
import type { OrderDTO } from '@core/types/order/common.js'
import { ContainerRegistrationKeys } from '@core/utils/container.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { computeFulfillmentStatus } from './utils/compute-fulfillment-status.js'

type CreateOrderShipmentInput = {
  orderId: string
  fulfillmentId: string
  trackingNumber?: string
  trackingUrl?: string
  labelUrl?: string
}

// Drives an order from fulfilled -> shipped. Records the shipment timestamp (and optional
// tracking info) on the fulfillment, then advances the order's fulfillment status.
export const createOrderShipmentWorkflow = createWorkflow<CreateOrderShipmentInput, OrderDTO>(
  { name: 'create-order-shipment', throws: [ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND] },
  async (ctx, input) => {
    // The order must be fulfilled before it can ship, and the fulfillment must actually
    // belong to this order (prevents shipping someone else's fulfillment).
    await ctx.step('validate-guards', async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      const fulfillmentService = container.resolve(Modules.FULFILLMENT)
      const linkService = container.resolve(ContainerRegistrationKeys.LINK)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status === 'canceled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot ship order ${input.orderId}: order is canceled`,
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

      if (status !== 'fulfilled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot ship order ${input.orderId}: fulfillment status is "${status}", expected "fulfilled"`,
        })
      }
    })

    // Stamp the fulfillment with a shippedAt date and optional tracking data.
    // The fulfillment module has no dedicated shipment entity — we use updateFulfillment
    // with date fields to record the lifecycle transition.
    await ctx.step(
      'mark-shipped',
      async ({ container }) => {
        const fulfillmentService = container.resolve(Modules.FULFILLMENT)
        const trackingData =
          input.trackingNumber || input.trackingUrl || input.labelUrl
            ? { trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl, labelUrl: input.labelUrl }
            : undefined

        await fulfillmentService.updateFulfillment(input.fulfillmentId, {
          shippedAt: new Date(),
          ...(trackingData ? { data: trackingData } : {}),
        })
      },
      async (_output, { container }) => {
        const fulfillmentService = container.resolve(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { shippedAt: null, data: null })
      },
    )

    return ctx.step('retrieve-order', async ({ container }) => {
      const orderService = container.resolve(Modules.ORDER)
      return orderService.retrieveOrder(input.orderId)
    })
  },
)
