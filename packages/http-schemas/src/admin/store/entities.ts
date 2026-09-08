import { z } from 'zod'

/**
 * One currency the store sells in.
 *
 * The code is what a price row carries, lowercased ISO 4217, so it is the only field the price
 * forms need — the display name is derived client-side rather than stored.
 */
export const AdminStoreCurrency = z
  .object({
    currencyCode: z.string(),
    isDefault: z.boolean(),
  })
  .openapi('AdminStoreCurrency')
export type AdminStoreCurrency = z.input<typeof AdminStoreCurrency>

/**
 * The store, with the currencies it sells in.
 *
 * The currencies travel with the store rather than behind their own route because every caller
 * wants both at once: there is exactly one store, and a currency is only meaningful as one of its.
 */
export const AdminStore = z
  .object({
    id: z.string(),
    name: z.string(),
    /** The region a shopper is served from before they pick one. */
    defaultRegionId: z.string().nullable(),
    currencies: z.array(AdminStoreCurrency),
  })
  .openapi('AdminStore')
export type AdminStore = z.input<typeof AdminStore>
