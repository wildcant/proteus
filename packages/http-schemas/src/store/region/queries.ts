import { z } from 'zod'

export const StoreCountryListParams = z.object({
  scope: z
    .enum(['sellable', 'all'])
    .default('sellable')
    .describe(
      'Which listing to return. "sellable" (the default) is the countries the store sells to, each ' +
        'with a currency and locale. "all" is the whole ISO 3166-1 table, for a form that has to ' +
        'accept an address anywhere; the countries outside a region carry null currency and locale.',
    ),
})

export type StoreCountryListQuery = z.infer<typeof StoreCountryListParams>
