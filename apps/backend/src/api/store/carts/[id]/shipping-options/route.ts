import type { ICartModuleService, IFulfillmentModuleService, IRegionModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { IdParams, StoreShippingOptionListParams, StoreShippingOptionListResponse } from '@proteus/http-schemas/store'

export const GetInput = { params: IdParams, query: StoreShippingOptionListParams }
export const GetOutput = StoreShippingOptionListResponse

/**
 * What the cart can be delivered by, which first means working out where it is going.
 *
 * The country is resolved in the order the signals are trusted. The shipping address is the
 * shopper's own answer, so it wins outright. A cart that has not reached the address step yet
 * still has a market — the region it was opened in — and its country is the honest stand-in:
 * shipping options carry a bare amount and no currency, so an option outside the cart's market
 * could not be quoted in the cart's money anyway. A region may cover several countries; the
 * preview then takes the first by code, and the address the shopper types replaces it, there
 * being no second signal on the cart to choose between them with.
 *
 * A cart with neither is one opened before the store had regions. It lists nothing rather than
 * guessing: every guess is somebody's market, and offering the wrong one's rates is worse than
 * offering none.
 *
 * Three reads across two modules and no writes, so it stays here rather than becoming a workflow
 * — there is nothing to unwind. See "Several reads, even across modules" in
 * `standards/rules/backend/api/__docs__/route-helpers.md`.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const { province, city, postalCode } = req.validatedQuery.filters
  const cartService = req.scope.resolve<ICartModuleService>(Modules.CART)

  const [shippingAddress] = await cartService.listCartAddresses({ cartId: req.params.id, type: 'shipping' })
  let countryCode = shippingAddress?.countryCode?.toLowerCase() ?? null

  if (!countryCode) {
    // Only reached when there is no address to read the country off. Also the not-found guard: an
    // unknown cart id fails here rather than answering with an empty option list.
    const cart = await cartService.retrieveCart(req.params.id)

    if (cart.regionId) {
      const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
      const [country] = await regionService.listCountries(
        { regionId: cart.regionId },
        { order: { id: 'ASC' }, limit: 1 },
      )
      countryCode = country?.id ?? null
    }
  }

  if (!countryCode) return { status: 200, json: { shippingOptions: [] } }

  const fulfillmentService = req.scope.resolve<IFulfillmentModuleService>(Modules.FULFILLMENT)

  const shippingOptions = await fulfillmentService.listShippingOptionsForContext({
    countryCode,
    province,
    city,
    postalCode,
  })

  return { status: 200, json: { shippingOptions } }
}
