import { z } from 'zod'

/**
 * No `countryCode`. The country a cart ships to is resolved server-side from the cart — its
 * shipping address, else its region — for the same reason the currency is: a caller-supplied
 * country is a second source of truth that can disagree with the cart, and a shipping option
 * carries a bare amount in no currency, so one from outside the cart's market could not be
 * quoted in the cart's money.
 */
export const StoreShippingOptionListParams = z.object({
  province: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
})

export type StoreShippingOptionListQuery = z.infer<typeof StoreShippingOptionListParams>
