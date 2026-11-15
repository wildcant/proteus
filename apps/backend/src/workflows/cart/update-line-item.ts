import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartLineItemDTO } from '@core/types/cart/common.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { confirmVariantInventoryStep, confirmVariantInventoryThrows } from './steps/confirm-variant-inventory.js'
import { refreshCartShippingMethodsStep } from './steps/refresh-cart-shipping-methods.js'

export type UpdateLineItemInput = {
  cartId: string
  lineItemId: string
  quantity?: number | undefined
}

/**
 * Sets a cart line's quantity, refusing one the shelf cannot cover by the same rule `add-to-cart`
 * confirms an addition with — so a stepper that let a shopper past the stock it was shown cannot
 * put a quantity in the cart that checkout would then refuse.
 *
 * TODO(locking): the read the stock check is made from is not part of the write, the same window
 * `add-to-cart` leaves open.
 */
export const updateLineItemWorkflow = createWorkflow<UpdateLineItemInput, CartLineItemDTO>(
  {
    name: 'update-line-item',
    throws: [...confirmVariantInventoryThrows, ErrorTypes.NOT_ALLOWED, ErrorTypes.NOT_FOUND],
  },
  async (ctx, input) => {
    /**
     * The line is looked up under the cart named in the path, so a line id from another cart is not
     * found rather than edited: the cart id is what a shopper holds, and a line id alone must not
     * reach into someone else's cart. A completed cart is the record behind an order and is frozen.
     */
    const demands = await ctx.step('validate-line-item', async ({ container }) => {
      const cartService = container.resolve(Modules.CART)
      const [cart, [lineItem]] = await Promise.all([
        cartService.retrieveCart(input.cartId),
        cartService.listLineItems({ id: input.lineItemId, cartId: input.cartId }),
      ])

      if (!lineItem) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_FOUND,
          message: i18n.t('Line item "{lineItemId}" not found in cart "{cartId}"'),
          values: { lineItemId: input.lineItemId, cartId: input.cartId },
        })
      }

      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cart "{cartId}" is already completed'),
          values: { cartId: input.cartId },
        })
      }

      if (input.quantity === undefined || !lineItem.variantId) return []
      return [{ variantId: lineItem.variantId, quantity: input.quantity }]
    })

    await confirmVariantInventoryStep(ctx, demands)

    /**
     * One row in one module. Its compensation puts the quantity back if the shipping refresh after
     * it fails, so a cart never holds a quantity its shipping was not priced for.
     */
    const written = await ctx.step(
      'write-line-item',
      async ({ container }) => {
        const cartService = container.resolve(Modules.CART)
        const [previous] = await cartService.listLineItems({ id: input.lineItemId, cartId: input.cartId })
        const lineItem = await cartService.updateLineItem(input.lineItemId, { quantity: input.quantity })
        return { lineItem, previousQuantity: previous?.quantity ?? lineItem.quantity }
      },
      async ({ previousQuantity }, { container }) => {
        await container.resolve(Modules.CART).updateLineItem(input.lineItemId, { quantity: previousQuantity })
      },
    )

    await refreshCartShippingMethodsStep(ctx, { cartId: input.cartId })

    return written.lineItem
  },
)
