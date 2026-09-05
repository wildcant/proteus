import type { ICartModuleService, IFulfillmentModuleService, IRegionModuleService } from '@core/types/index.js'
import { Modules } from '@core/utils/index.js'
import { IdParams, StoreShippingOptionListParams, StoreShippingOptionListResponse } from '@proteus/http-schemas/store'
import type { AwilixContainer } from 'awilix'
import type { HttpRequest, HttpResult } from '../../../../../server/ports.js'

/**
 * Which country the cart ships to, in the order the signals are trusted.
 *
 * The shipping address is the shopper's own answer, so it wins outright. A cart that has not
 * reached the address step yet still has a market — the region it was opened in — and its
 * country is the honest stand-in: shipping options carry a bare amount and no currency, so an
 * option outside the cart's market could not be quoted in the cart's money anyway.
 *
 * Null when the cart has neither, which is a cart opened before the store had regions. The
 * caller lists nothing rather than guessing a country: every guess is somebody's market, and
 * offering the wrong one's rates is worse than offering none.
 *
 * A region may cover several countries. The preview then takes the first by code, and the
 * address the shopper types replaces it — there is no second signal on the cart to choose
 * between them with.
 */
async function resolveShippingCountry(scope: AwilixContainer, cartId: string): Promise<string | null> {
  const cartService = scope.resolve<ICartModuleService>(Modules.CART)

  const [shippingAddress] = await cartService.listCartAddresses({ cartId, type: 'shipping' })
  if (shippingAddress?.countryCode) return shippingAddress.countryCode.toLowerCase()

  // Only reached when there is no address to read the country off. Also the not-found guard:
  // an unknown cart id fails here rather than answering with an empty option list.
  const cart = await cartService.retrieveCart(cartId)
  if (!cart.regionId) return null

  const regionService = scope.resolve<IRegionModuleService>(Modules.REGION)
  const [country] = await regionService.listCountries({ regionId: cart.regionId }, { order: { id: 'ASC' }, limit: 1 })

  return country?.id ?? null
}

export const GetInput = { params: IdParams, query: StoreShippingOptionListParams }
export const GetOutput = StoreShippingOptionListResponse

export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const { province, city, postalCode } = req.validatedQuery.filters

  const countryCode = await resolveShippingCountry(req.scope, req.params.id)
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
