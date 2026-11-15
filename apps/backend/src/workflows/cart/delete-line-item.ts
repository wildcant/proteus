import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow } from '@core/workflows/types.js'
import { refreshCartShippingMethodsStep } from './steps/refresh-cart-shipping-methods.js'

export type DeleteLineItemInput = {
  cartId: string
  lineItemId: string
}

/**
 * Removes a line from a cart and re-prices its shipping, Medusa's `deleteLineItemsWorkflow`: a
 * courier that charges by the parcel quotes less once an item is gone.
 *
 * Declares no errors of its own: `removeLineItem` raises NOT_FOUND (a line the cart does not hold)
 * and NOT_ALLOWED (a completed cart) from the cart module, which the route declares.
 */
export const deleteLineItemWorkflow = createWorkflow<DeleteLineItemInput, void>(
  { name: 'delete-line-item', throws: [] },
  async (ctx, input) => {
    await ctx.step(
      'remove-line-item',
      async ({ container }) => {
        await container.resolve(Modules.CART).removeLineItem(input.cartId, input.lineItemId)
      },
      async (_output, { container }) => {
        await container.resolve(Modules.CART).restoreLineItems([input.lineItemId])
      },
    )

    await refreshCartShippingMethodsStep(ctx, { cartId: input.cartId })
  },
)
