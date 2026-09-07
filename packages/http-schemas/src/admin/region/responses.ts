import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminCountry, AdminRegion } from './entities.js'

export const AdminRegionResponse = z.object({ region: AdminRegion }).openapi('AdminRegionResponse')
export type AdminRegionResponse = z.input<typeof AdminRegionResponse>

export const AdminRegionListResponse = PaginatedResponse.extend({
  regions: z.array(AdminRegion),
}).openapi('AdminRegionListResponse')
export type AdminRegionListResponse = z.input<typeof AdminRegionListResponse>

export const AdminCountryResponse = z.object({ country: AdminCountry }).openapi('AdminCountryResponse')
export type AdminCountryResponse = z.input<typeof AdminCountryResponse>

export const AdminCountryListResponse = PaginatedResponse.extend({
  countries: z.array(AdminCountry),
}).openapi('AdminCountryListResponse')
export type AdminCountryListResponse = z.input<typeof AdminCountryListResponse>

/**
 * The countries an assignment touched. Unpaginated, because it answers for exactly the rows the
 * request named rather than for a page of a listing.
 */
export const AdminRegionCountriesResponse = z
  .object({ countries: z.array(AdminCountry) })
  .openapi('AdminRegionCountriesResponse')
export type AdminRegionCountriesResponse = z.input<typeof AdminRegionCountriesResponse>
