import { z } from 'zod'
import { storeCurrencyCode } from './payloads.js'

/**
 * One currency within the store, addressed by its ISO 4217 code.
 *
 * The code rather than the row id, because the code is what every other surface carries — a price
 * row, a region, the price editor's column header — so it is the only handle a caller already has.
 * Lowercased on the way in for the same reason the payload is.
 */
export const StoreCurrencyParams = z.object({
  code: storeCurrencyCode,
})
export type StoreCurrencyParams = z.infer<typeof StoreCurrencyParams>
