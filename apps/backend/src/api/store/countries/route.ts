import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/modules-definition.js'
import { StoreCountryListParams, StoreCountryListResponse } from '@proteus/http-schemas/store'
import type { HttpRequest, HttpResult } from '../../../framework/http/ports.js'

export const GetInput = { query: StoreCountryListParams }
export const GetOutput = StoreCountryListResponse

/**
 * The country list, flat and already sorted, in the two shapes a storefront needs: the markets it
 * can sell to, and the whole ISO table for an address form. Both come back as exactly what the
 * caller renders — nothing here is nested for the client to flatten, filter or re-sort.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)
  const { scope } = req.validatedQuery.filters

  const countries = await regionService.listCountryMarkets({ onlySellable: scope !== 'all' })

  return { status: 200, json: { countries } }
}
