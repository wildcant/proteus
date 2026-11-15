import { BigNumber } from '@core/bignumber.js'
import type { ShippingMethodPriceUpdateDTO } from '@core/types/cart/mutations.js'
import type { AppContainer } from '@core/types/container.js'
import type { CalculateShippingPriceContext } from '@core/types/fulfillment/provider.js'
import { Modules } from '@core/utils/modules-definition.js'
import type { WorkflowContext } from '@core/workflows/types.js'
import { buildShippingPricingContext } from '../utils/shipping-pricing-context.js'

/**
 * Reads what a cart's shipping is priced from — its address (or its region's country before one is
 * entered), its lines and their variants — and shapes it into the fulfillment module's plain
 * pricing context. Null when the cart has no country to ship to.
 *
 * Shared by the steps that price a cart's shipping, so setting a method and refreshing one quote
 * the same context. Reads only; it runs inside a step action.
 */
export async function loadCartShippingPricingContext(
  container: AppContainer,
  cartId: string,
): Promise<CalculateShippingPriceContext | null> {
  const cartService = container.resolve(Modules.CART)
  const [cart, [shippingAddress], lineItems] = await Promise.all([
    cartService.retrieveCart(cartId),
    cartService.listCartAddresses({ cartId, type: 'shipping' }),
    cartService.listLineItems({ cartId }),
  ])

  const variantIds = [...new Set(lineItems.flatMap((item) => (item.variantId ? [item.variantId] : [])))]
  const [variants, regionCountries] = await Promise.all([
    variantIds.length > 0 ? container.resolve(Modules.PRODUCT).listProductVariants({ id: variantIds }) : [],
    !shippingAddress?.countryCode && cart.regionId
      ? container.resolve(Modules.REGION).listCountries({ regionId: cart.regionId }, { order: { id: 'ASC' }, limit: 1 })
      : [],
  ])

  return buildShippingPricingContext({
    cart,
    shippingAddress: shippingAddress ?? null,
    regionCountryCode: regionCountries[0]?.id ?? null,
    lineItems,
    variants,
  })
}

/** What a refresh changed, so its compensation can put each method back as it was. */
type ShippingMethodRefreshResult = {
  previousPrices: ShippingMethodPriceUpdateDTO[]
  removedIds: string[]
}

export type RefreshCartShippingMethodsInput = {
  cartId: string
  /**
   * The workflow refreshes later instead, so this run records that it did nothing. A step cannot
   * sit behind an `if`, so a workflow that refreshes at one of two points says which here.
   */
  deferred?: boolean | undefined
}

/**
 * Medusa's `refreshCartShippingMethodsWorkflow`, as a step every workflow that changes what a
 * shipping price depends on runs last: adding, changing or removing a line, and changing the
 * shipping address or the market.
 *
 * Each method is re-priced for the cart as it now stands — a calculated one by its provider, a flat
 * one at its option's current amount — and a method whose option no longer serves the address, is
 * disabled, or that its provider can no longer price there is removed, leaving the shopper to choose
 * again from what the cart now lists. A method with no option behind it cannot be shown to still
 * apply, so it goes too.
 *
 * `name` lets one workflow run it at two points; the default suits every caller that runs it once.
 */
export async function refreshCartShippingMethodsStep(
  ctx: WorkflowContext,
  input: RefreshCartShippingMethodsInput,
  name = 'refresh-cart-shipping-methods',
): Promise<ShippingMethodRefreshResult> {
  return ctx.step<ShippingMethodRefreshResult>(
    name,
    async ({ container }) => {
      if (input.deferred) return { previousPrices: [], removedIds: [] }

      const cartService = container.resolve(Modules.CART)
      const shippingMethods = await cartService.listShippingMethods({ cartId: input.cartId })
      if (shippingMethods.length === 0) return { previousPrices: [], removedIds: [] }

      const pricingContext = await loadCartShippingPricingContext(container, input.cartId)
      const priced = pricingContext
        ? await container.resolve(Modules.FULFILLMENT).priceShippingOptionsForContext(
            shippingMethods.flatMap((method) =>
              method.shippingOptionId ? [{ id: method.shippingOptionId, data: method.data }] : [],
            ),
            pricingContext,
          )
        : []
      const priceByOptionId = new Map(priced.map((option) => [option.id, option.calculatedPrice]))

      const update: ShippingMethodPriceUpdateDTO[] = []
      const previousPrices: ShippingMethodPriceUpdateDTO[] = []
      const removedIds: string[] = []
      for (const method of shippingMethods) {
        const price = method.shippingOptionId ? priceByOptionId.get(method.shippingOptionId) : undefined
        if (!price) {
          removedIds.push(method.id)
          continue
        }
        update.push({
          id: method.id,
          amount: new BigNumber(price.calculatedAmount),
          isTaxInclusive: price.isCalculatedPriceTaxInclusive,
        })
        previousPrices.push({ id: method.id, amount: method.amount, isTaxInclusive: method.isTaxInclusive })
      }

      await cartService.applyShippingMethodRefresh({ update, remove: removedIds })
      return { previousPrices, removedIds }
    },
    async ({ previousPrices, removedIds }, { container }) => {
      if (previousPrices.length === 0 && removedIds.length === 0) return
      const cartService = container.resolve(Modules.CART)
      await cartService.applyShippingMethodRefresh({ update: previousPrices, remove: [] })
      if (removedIds.length > 0) await cartService.restoreShippingMethods(removedIds)
    },
  )
}
