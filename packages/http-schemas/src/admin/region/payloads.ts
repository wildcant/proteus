import { z } from 'zod'
import { entityId, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

/**
 * The currency a region settles in, as a client sends it.
 *
 * Lowercased on the way in so `USD` and `usd` name the same currency: every price row, every store
 * currency and the seed all carry the lowercase form, and a region whose code disagrees in case is
 * a region whose products cannot be priced. The membership check against the store's currencies is
 * the API's, not the schema's — it needs a database.
 */
const currencyCode = machineCode
  .min(3)
  .max(3)
  .transform((code) => code.toLowerCase())

/** Which gateways the region offers. Ids only: the providers themselves are registered code. */
const paymentProviderIds = z.array(entityId.min(1)).max(MAX_ITEMS.small)

export const AdminCreateRegion = z
  .object({
    name: shortText.min(1),
    currencyCode,
    paymentProviderIds: paymentProviderIds.optional(),
  })
  .openapi('AdminCreateRegion')
export type AdminCreateRegionBody = z.infer<typeof AdminCreateRegion>

/**
 * Every field optional, and `paymentProviderIds` replaces the set rather than adding to it —
 * omitting it leaves the region's providers alone, which is what lets the name be renamed on its
 * own without the caller having to resend a list it never showed the merchant.
 */
export const AdminUpdateRegion = z
  .object({
    name: shortText.min(1).optional(),
    currencyCode: currencyCode.optional(),
    paymentProviderIds: paymentProviderIds.optional(),
  })
  .openapi('AdminUpdateRegion')
export type AdminUpdateRegionBody = z.infer<typeof AdminUpdateRegion>
