import { Modules } from '@core/utils/modules-definition.js'
import { StoreCountryListParams, StoreCountryListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../framework/http/ports.js'

export const GetInput = { query: StoreCountryListParams }
export const GetOutput = StoreCountryListResponse

/**
 * The country list, flat and already sorted, in the two shapes a storefront needs: the markets it
 * can sell to, and the whole ISO table for an address form. Both come back as exactly what the
 * caller renders — nothing here is nested for the client to flatten, filter or re-sort.
 *
 * `defaultMarket` rides alongside: the market behind `store.defaultRegionId`, where a shopper with
 * no country of their own lands. Null when the store has no default region or it sells nowhere.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const regionService = req.scope.resolve(Modules.REGION)
  const { scope } = req.validatedQuery.filters

  const store = await req.scope.resolve(Modules.STORE).resolveStore()

  const [countries, defaultMarket] = await Promise.all([
    regionService.listCountryMarkets({ onlySellable: scope !== 'all' }),
    store?.defaultRegionId ? regionService.retrieveRegionMarket(store.defaultRegionId) : null,
  ])

  return { status: 200, json: { countries, defaultMarket } }
}
