import { AdminAssignRegionCountries, AdminRegionCountriesResponse, IdParams } from '@proteus/http-schemas/admin'
import type { HttpRequest, HttpResult } from '@server/ports.js'
import { assignRegionCountriesWorkflow } from '@workflows/region/assign-region-countries.js'
import { buildCountryViews } from '@workflows/region/utils/build-country-views.js'

export const PostInput = { params: IdParams, body: AdminAssignRegionCountries }
export const PostOutput = AdminRegionCountriesResponse
export const PostThrows = [...assignRegionCountriesWorkflow.throws] as const

/**
 * Makes countries sellable in this region.
 *
 * The locale is required on every entry, and that refusal is the point of the route: `regionId` is
 * what makes a country sellable and `localeCode` is what its storefront's URL segment, `lang`
 * attribute and every number and date formatter are drawn from. A country assigned without one is a
 * market that renders broken, so the pair is written in a single request and rejected as a pair.
 * The Add-countries form collects the locale for the same reason; it is a convenience, not the
 * guarantee.
 *
 * 200 rather than 201: the ISO table ships whole, so nothing is created here — existing rows are
 * pointed at a region.
 */
export const POST = async (req: HttpRequest<typeof PostInput>): Promise<HttpResult<typeof PostOutput>> => {
  const assigned = await assignRegionCountriesWorkflow.run({
    regionId: req.params.id,
    countries: req.body.countries,
  })

  return { status: 200, json: { countries: buildCountryViews(assigned) } }
}
