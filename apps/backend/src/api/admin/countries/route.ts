import type { IRegionModuleService } from '@core/types/region/service.js'
import { Modules } from '@core/utils/index.js'
import type { HttpRequest, HttpResult } from '@framework/http/ports.js'
import { AdminCountryListParams, AdminCountryListResponse } from '@proteus/http-schemas/admin'

export const GetInput = { query: AdminCountryListParams }
export const GetOutput = AdminCountryListResponse

/**
 * The ISO 3166-1 table, each row carrying the region that sells to it and the locale that region
 * reads it in.
 *
 * One route serving two screens, because they want the same rows filtered differently: the region's
 * Countries card asks for `regionId`, and the Add-countries picker asks for all of them and offers
 * the ones no region has claimed. That is why `regionId` is a filter rather than a path segment,
 * and why the row carries its region instead of the caller inferring one.
 *
 * The page is cut here rather than in the query, as `GET /admin/regions` does: the region module
 * exposes `listCountries` and no counting counterpart, and this list is 249 rows by definition.
 */
export const GET = async (req: HttpRequest<typeof GetInput>): Promise<HttpResult<typeof GetOutput>> => {
  const regionService = req.scope.resolve<IRegionModuleService>(Modules.REGION)

  const { pagination, filters } = req.validatedQuery
  const { offset, limit, order } = pagination

  const matching = await regionService.listCountries(filters, { order: order ?? { displayName: 'ASC' } })

  return {
    status: 200,
    json: {
      countries: matching.slice(offset, offset + limit),
      count: matching.length,
      offset,
      limit,
    },
  }
}
