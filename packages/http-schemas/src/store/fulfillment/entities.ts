import { z } from 'zod'

export const StoreShippingOption = z
  .object({
    id: z.string(),
    name: z.string(),
    amount: z.number().nullable(),
    serviceZoneId: z.string(),
    shippingProfileId: z.string(),
    shippingOptionTypeId: z.string().nullable(),
    providerId: z.string(),
    data: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('StoreShippingOption')
export type StoreShippingOption = z.input<typeof StoreShippingOption>
