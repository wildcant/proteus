import { z } from 'zod'

export const StoreShippingOption = z
  .object({
    id: z.string(),
    name: z.string(),
    /** `flat` costs the option's own amount; `calculated` is priced by its provider for the cart. */
    priceType: z.enum(['flat', 'calculated']),
    /** What the option costs this cart, in the cart's currency: the flat amount, or the calculated price. */
    amount: z.number(),
    isTaxInclusive: z.boolean(),
    serviceZoneId: z.string(),
    shippingProfileId: z.string(),
    shippingOptionTypeId: z.string().nullable(),
    providerId: z.string(),
    data: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('StoreShippingOption')
export type StoreShippingOption = z.input<typeof StoreShippingOption>
