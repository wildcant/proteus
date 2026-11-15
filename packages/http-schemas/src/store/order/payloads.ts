import { i18n } from '@proteus/utils'
import { z } from 'zod'

/** A shopper who lost an Order's link finds it again by its number and the end of their phone. */
export const StoreLookupOrder = z.object({
  displayId: z.number().int().positive(),
  // A shopper types digits as their phone shows them, so spaces and dashes are dropped before the
  // four digits are required.
  phoneLastDigits: z
    .string()
    .max(32)
    .transform((typed) => typed.replace(/\D/g, ''))
    .pipe(z.string().regex(/^\d{4}$/, i18n.t('Enter the last 4 digits of your phone'))),
})
export type StoreLookupOrderBody = z.infer<typeof StoreLookupOrder>
