import type { OrderLineItemDTO } from '@core/types/order/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { confirmVariantInventoryStep, confirmVariantInventoryThrows } from '../cart/steps/confirm-variant-inventory.js'
import type { VariantDemand } from '../cart/utils/variant-inventory.js'
import { refreshDraftOrderShippingMethodsStep } from './steps/refresh-draft-order-shipping-methods.js'

export type UpdateDraftOrderItemInput = {
  orderId: string
  lineItemId: string
  quantity: number
}

/**
 * Changes a draft line's quantity (Medusa's draft edit `updateDraftOrderItem`), confirmed against
 * stock at the quantity it ends up at, then re-prices a calculated shipping method.
 *
 * The line's own refusals — not in this draft (NOT_FOUND), the draft no longer open (NOT_ALLOWED) —
 * are the order module's, which the route declares.
 */
export const updateDraftOrderItemWorkflow = createWorkflow<UpdateDraftOrderItemInput, OrderLineItemDTO>(
  { name: 'update-draft-order-item', throws: [...confirmVariantInventoryThrows] },
  async (ctx, input) => {
    const demands = await ctx.step<VariantDemand[]>('plan-draft-order-item', async ({ container }) => {
      const [lineItem] = await container
        .resolve(Modules.ORDER)
        .listOrderLineItems({ id: input.lineItemId, orderId: input.orderId })
      return lineItem?.variantId ? [{ variantId: lineItem.variantId, quantity: input.quantity }] : []
    })

    await confirmVariantInventoryStep(ctx, demands)

    const updated = await ctx.step<{ lineItem: OrderLineItemDTO; previousQuantity: number }>(
      'update-draft-order-item',
      async ({ container }) => {
        const orderService = container.resolve(Modules.ORDER)
        const [previous] = await orderService.listOrderLineItems({ id: input.lineItemId, orderId: input.orderId })
        const lineItem = await orderService.updateDraftOrderLineItem(input.orderId, input.lineItemId, input.quantity)
        return { lineItem, previousQuantity: previous?.quantity ?? lineItem.quantity }
      },
      async ({ lineItem, previousQuantity }, { container }) => {
        await container
          .resolve(Modules.ORDER)
          .updateOrderLineItemQuantities([{ id: lineItem.id, quantity: previousQuantity }])
      },
    )

    await refreshDraftOrderShippingMethodsStep(ctx, { orderId: input.orderId })

    return updated.lineItem
  },
)
