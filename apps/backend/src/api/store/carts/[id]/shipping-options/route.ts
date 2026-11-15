import { Modules } from '@core/utils/modules-definition.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreShippingOptionListParams, StoreShippingOptionListResponse } from '@proteus/http-schemas/store'
import { buildShippingPricingContext } from '@workflows/cart/utils/shipping-pricing-context.js'

export const GetInput = { params: IdParams, query: StoreShippingOptionListParams }
export const GetOutput = StoreShippingOptionListResponse

/**
 * What the cart can be delivered by, and what each costs, Medusa's
 * `listShippingOptionsForCartWithPricingWorkflow`. Which means first working out where it is going.
 *
 * The country is resolved in the order the signals are trusted. The shipping address is the
 * shopper's own answer, so it wins outright. A cart that has not reached the address step yet
 * still has a market — the region it was opened in — and its country is the honest stand-in:
 * shipping options carry a bare amount and no currency, so an option outside the cart's market
 * could not be quoted in the cart's money anyway. A region may cover several countries; the
 * preview then takes the first by code, and the address the shopper types replaces it, there
 * being no second signal on the cart to choose between them with.
 *
 * Province, city and postal code come from the address too; the query's values stand in for them,
 * so a storefront can quote a city the shopper is typing before it saves the address.
 *
 * A cart with neither is one opened before the store had regions. It lists nothing rather than
 * guessing: every guess is somebody's market, and offering the wrong one's rates is worse than
 * offering none.
 *
 * Only options serving the address are listed, and a calculated one only when its provider could
 * price it for this address and these items. Reads across four modules and no writes, so it stays
 * here rather than becoming a workflow — see "Several reads, even across modules" in
 * `standards/rules/backend/api/__docs__/route-helpers.md`.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const { province, city, postalCode } = req.validatedQuery.filters
  const cartService = req.scope.resolve(Modules.CART)

  // Also the not-found guard: an unknown cart id fails here rather than answering with no options.
  const [cart, [shippingAddress], lineItems] = await Promise.all([
    cartService.retrieveCart(req.params.id),
    cartService.listCartAddresses({ cartId: req.params.id, type: 'shipping' }),
    cartService.listLineItems({ cartId: req.params.id }),
  ])

  const variantIds = [...new Set(lineItems.flatMap((item) => (item.variantId ? [item.variantId] : [])))]
  const [variants, regionCountries] = await Promise.all([
    variantIds.length > 0 ? req.scope.resolve(Modules.PRODUCT).listProductVariants({ id: variantIds }) : [],
    !shippingAddress?.countryCode && cart.regionId
      ? req.scope.resolve(Modules.REGION).listCountries({ regionId: cart.regionId }, { order: { id: 'ASC' }, limit: 1 })
      : [],
  ])

  const pricingContext = buildShippingPricingContext({
    cart,
    shippingAddress: shippingAddress ?? null,
    regionCountryCode: regionCountries[0]?.id ?? null,
    lineItems,
    variants,
  })
  if (!pricingContext) return { status: 200, json: { shippingOptions: [] } }

  const shippingOptions = await req.scope.resolve(Modules.FULFILLMENT).listPricedShippingOptionsForContext({
    ...pricingContext,
    shippingAddress: {
      ...pricingContext.shippingAddress,
      province: province ?? pricingContext.shippingAddress.province,
      city: city ?? pricingContext.shippingAddress.city,
      postalCode: postalCode ?? pricingContext.shippingAddress.postalCode,
    },
  })

  return {
    status: 200,
    json: {
      shippingOptions: shippingOptions.map((option) => ({
        ...option,
        amount: option.calculatedPrice.calculatedAmount,
        isTaxInclusive: option.calculatedPrice.isCalculatedPriceTaxInclusive,
      })),
    },
  }
}
