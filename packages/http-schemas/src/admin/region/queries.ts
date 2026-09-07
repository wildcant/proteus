import { z } from 'zod'
import { countryCode } from '../../bounded.js'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminRegionListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminRegionListQuery = FindParams<typeof AdminRegionListParams>

/**
 * `limit` is widened past the shared ceiling of 100 because this list has a fixed, known size:
 * ISO 3166-1 defines 249 alpha-2 codes and the table ships whole. The Add-countries picker renders
 * all of them as one searchable field, so paging it would mean a merchant typing "Colombia" and
 * being told there are no results because the match is on page three. The default stays at 20, so
 * the region's Countries table pages like every other admin list.
 */
export const AdminCountryListParams = createFindParams().extend({
  limit: z.coerce.number().int().min(1).max(300).default(20),
  q: z.string().optional(),
  /** The countries one region sells to. Omitted lists every country, assigned or not. */
  regionId: z.string().optional(),
})
export type AdminCountryListQuery = FindParams<typeof AdminCountryListParams>

/** A country within a region: the region's id, and the ISO 3166-1 alpha-2 code of the country. */
export const RegionCountryParams = z.object({
  id: z.string().min(1),
  code: countryCode.min(2).transform((code) => code.toLowerCase()),
})
export type RegionCountryParams = z.infer<typeof RegionCountryParams>
