import { BigNumber } from '@core/bignumber.js'
import { ErrorTypes } from '@core/errors/app-error.js'
import type { CartShippingMethodDTO } from '@core/types/cart/common.js'
import { FulfillmentErrorCodes } from '@core/types/fulfillment/errors.js'
import { Modules } from '@core/utils/modules-definition.js'
import { createWorkflow, WorkflowTerminalError } from '@core/workflows/types.js'
import { i18n } from '@proteus/utils'
import { loadCartShippingPricingContext } from './steps/refresh-cart-shipping-methods.js'

export type AddShippingMethodToCartInput = {
  cartId: string
  shippingOptionId: string
  /** What the shopper sends with the choice, which the option's provider validates. */
  data?: Record<string, unknown> | null | undefined
}

/** The method as priced, before it is written. Plain numbers, so it records the same on both engines. */
type PricedShippingMethod = {
  name: string
  amount: number
  isTaxInclusive: boolean
  shippingOptionId: string
  data: Record<string, unknown>
}

/**
 * Makes an option the cart's shipping method, Medusa's `addShippingMethodToCartWorkflow`.
 *
 * The option is validated against the cart as it stands: it must be enabled, serve the cart's
 * address (its region's country before one is entered) and, when calculated, be priced by its
 * provider for the cart's address and items. The method then carries that price — never one from
 * the request — and the provider's `validateFulfillmentData` answer as its `data`, so what the price
 * was based on travels with it to the order.
 */
export const addShippingMethodToCartWorkflow = createWorkflow<AddShippingMethodToCartInput, CartShippingMethodDTO>(
  { name: 'add-shipping-method-to-cart', throws: [ErrorTypes.NOT_ALLOWED] },
  async (ctx, input) => {
    const method = await ctx.step<PricedShippingMethod>('price-shipping-method', async ({ container }) => {
      const cart = await container.resolve(Modules.CART).retrieveCart(input.cartId)
      if (cart.completedAt) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          message: i18n.t('Cart "{cartId}" is already completed'),
          values: { cartId: input.cartId },
        })
      }

      const fulfillmentService = container.resolve(Modules.FULFILLMENT)
      const data = input.data ?? {}
      const pricingContext = await loadCartShippingPricingContext(container, input.cartId)
      const [quoted] = pricingContext
        ? await fulfillmentService.quoteShippingOptionsForContext(
            [{ id: input.shippingOptionId, data }],
            pricingContext,
          )
        : []

      if (!quoted) {
        throw new WorkflowTerminalError({
          type: ErrorTypes.NOT_ALLOWED,
          code: FulfillmentErrorCodes.OPTION_UNAVAILABLE,
          message: i18n.t('Shipping option "{shippingOptionId}" is not available'),
          values: { shippingOptionId: input.shippingOptionId },
        })
      }

      return {
        name: quoted.name,
        amount: quoted.calculatedPrice.calculatedAmount,
        isTaxInclusive: quoted.calculatedPrice.isCalculatedPriceTaxInclusive,
        shippingOptionId: quoted.id,
        data: quoted.fulfillmentData,
      }
    })

    /**
     * One replacement in one module: `setShippingMethod` hides the old method and writes the new one
     * in a transaction, so there is nothing for a compensation to put back. It is the last step.
     */
    return ctx.step('set-shipping-method', async ({ container }) => {
      return container.resolve(Modules.CART).setShippingMethod(input.cartId, {
        ...method,
        amount: new BigNumber(method.amount),
      })
    })
  },
)
