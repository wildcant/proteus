import { z } from 'zod'
import { StoreCountry } from './entities.js'

export const StoreCountryListResponse = z
  .object({ countries: z.array(StoreCountry) })
  .openapi('StoreCountryListResponse')
export type StoreCountryListResponse = z.input<typeof StoreCountryListResponse>
