import { z } from 'zod'
import { StoreCountry } from './entities.js'

export const StoreCountryListResponse = z
  .object({
    countries: z.array(StoreCountry),
    defaultMarket: StoreCountry.nullable().describe(
      "The first country, by display name, of the store's default region — where a shopper with no " +
        'country of their own lands. Null when the store has no default region or it sells nowhere.',
    ),
  })
  .openapi('StoreCountryListResponse')
export type StoreCountryListResponse = z.input<typeof StoreCountryListResponse>
