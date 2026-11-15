import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { refreshDraftOrderShippingMethodsStep } from './steps/refresh-draft-order-shipping-methods.js'

export type RemoveDraftOrderItemInput = {
  orderId: string
  lineItemId: string
}

/**
 * Removes a line from a Draft Order (Medusa's draft edit `removeDraftOrderActionItem`) and re-prices
 * a calculated shipping method: a courier that charges by the parcel quotes less once an item is gone.
 *
 * Declares no errors of its own: the order module refuses a line not in this draft (NOT_FOUND) and
 * a draft no longer open (NOT_ALLOWED), which the route declares.
 */
export const removeDraftOrderItemWorkflow = createWorkflow<RemoveDraftOrderItemInput, void>(
  { name: 'remove-draft-order-item', throws: [] },
  async (ctx, input) => {
    await ctx.step(
      'remove-draft-order-item',
      async ({ container }) => {
        await container.resolve(Modules.ORDER).removeDraftOrderLineItem(input.orderId, input.lineItemId)
      },
      async (_output, { container }) => {
        await container.resolve(Modules.ORDER).restoreOrderLineItems([input.lineItemId])
      },
    )

    await refreshDraftOrderShippingMethodsStep(ctx, { orderId: input.orderId })
  },
)
