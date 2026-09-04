import { z } from 'zod'

export const StoreCountry = z
  .object({
    iso2: z.string().describe('ISO 3166-1 alpha-2, lowercased. What a country is selected by everywhere else.'),
    displayName: z.string().describe('The country name as a shopper reads it. Listings come sorted by it.'),
    currencyCode: z
      .string()
      .nullable()
      .describe('ISO 4217, lowercased, from the owning region. Null only for a country no region owns.'),
    localeCode: z
      .string()
      .nullable()
      .describe(
        'BCP 47 tag, e.g. es-CO — the URL segment, the document language, and the tag every number ' +
          'and date formatter is given. Null on the same countries currencyCode is.',
      ),
  })
  .openapi('StoreCountry')
export type StoreCountry = z.input<typeof StoreCountry>
