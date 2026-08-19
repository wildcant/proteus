import { ErrorTypes } from '@core/errors/app-error.js'
import type { IFulfillmentModuleService } from '@core/types/fulfillment/service.js'
import type { ILinkService } from '@core/types/link/service.js'
import type { OrderDTO } from '@core/types/order/common.js'
import type { IOrderModuleService } from '@core/types/order/service.js'
import { ContainerRegistrationKeys, Modules } from '@core/utils/index.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'

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
  'create-order-shipment',
  async (ctx, input) => {
    // The order must be fulfilled before it can ship, and the fulfillment must actually
    // belong to this order (prevents shipping someone else's fulfillment).
    await ctx.step('validate-guards', async ({ container }) => {
      const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
      const order = await orderService.retrieveOrder(input.orderId)

      if (order.status === 'canceled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot ship order ${input.orderId}: order is canceled`,
        })
      }

      if (order.fulfillmentStatus !== 'fulfilled') {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: `Cannot ship order ${input.orderId}: fulfillment status is "${order.fulfillmentStatus}", expected "fulfilled"`,
        })
      }

      const linkService = container.resolve<ILinkService>(ContainerRegistrationKeys.LINK)
      const link = await linkService.repo('orderFulfillment').findByFulfillmentId(input.fulfillmentId)

      if (!link || link.orderId !== input.orderId) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: `Fulfillment ${input.fulfillmentId} is not linked to order ${input.orderId}`,
        })
      }
    })

    // Stamp the fulfillment with a shippedAt date and optional tracking data.
    // The fulfillment module has no dedicated shipment entity — we use updateFulfillment
    // with date fields to record the lifecycle transition.
    await ctx.step(
      'mark-shipped',
      async ({ container }) => {
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
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
        const fulfillmentService = container.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)
        await fulfillmentService.updateFulfillment(input.fulfillmentId, { shippedAt: null, data: null })
      },
    )

    // Advance the order so downstream consumers (admin UI, mark-as-delivered) see the
    // correct state. Compensates back to "fulfilled" if this step fails.
    const updated = await ctx.step(
      'update-fulfillment-status',
      async ({ container }) => {
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        return orderService.updateFulfillmentStatus(input.orderId, 'shipped')
      },
      async (_output, { container }) => {
        const orderService = container.resolve<IOrderModuleService>(Modules.ORDER)
        await orderService.updateFulfillmentStatus(input.orderId, 'fulfilled')
      },
    )

    return updated
  },
)
