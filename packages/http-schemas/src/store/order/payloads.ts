import { i18n } from '@proteus/utils'
import { z } from 'zod'

/** A shopper who lost an Order's link finds it again by its number and the end of their phone. */
export const StoreLookupOrder = z.object({
  displayId: z.number().int().positive(),
  phoneLastDigits: z
    .string()
    .length(4)
    .regex(/^\d{4}$/, i18n.t('Enter the last 4 digits of your phone')),
})
export type StoreLookupOrderBody = z.infer<typeof StoreLookupOrder>
