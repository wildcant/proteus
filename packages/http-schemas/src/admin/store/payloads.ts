import { z } from 'zod'
import { entityId, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

/**
 * A currency the store trades in, as a client sends it.
 *
 * Lowercased on the way in so `USD` and `usd` name the same currency: every price row, every
 * region and the seed all carry the lowercase form, and a store currency whose code disagrees in
 * case is a column the price editor draws twice.
 *
 * The three-letter shape is enforced rather than assumed, because this code is the one the admin
 * hands to `Intl.DisplayNames` to label the row with — and `Intl` answers a malformed currency
 * code with a `RangeError`, not with a fallback. The store's currency list is the last place a
 * code enters the system, so refusing it here is what keeps every screen below it renderable.
 */
export const storeCurrencyCode = machineCode
  .min(3)
  .max(3)
  .regex(/^[A-Za-z]{3}$/, 'Not an ISO 4217 currency code')
  .transform((code) => code.toLowerCase())

/**
 * The store's own details. Every field optional, so the Edit drawer can save a rename without
 * resending a region it never showed the merchant.
 *
 * `defaultRegionId` is nullable rather than merely optional, and the two mean different things:
 * omitting it leaves the default region alone, sending `null` clears it. A merchant who has no
 * region they want shoppers to land in needs the second, and an optional-only field offers no way
 * to say it.
 */
export const AdminUpdateStore = z
  .object({
    name: shortText.min(1).optional(),
    defaultRegionId: entityId.min(1).nullable().optional(),
  })
  .openapi('AdminUpdateStore')
export type AdminUpdateStoreBody = z.infer<typeof AdminUpdateStore>

/**
 * The currencies to start trading in.
 *
 * A list rather than one code per request, because the picker this comes from is a multi-select:
 * a merchant opening a second market chooses its currency alongside the ones they already meant
 * to add, and three requests where one would do is three chances to half-finish.
 */
export const AdminAddStoreCurrencies = z
  .object({
    currencyCodes: z.array(storeCurrencyCode).min(1, 'Select at least one currency.').max(MAX_ITEMS.batch),
  })
  .openapi('AdminAddStoreCurrencies')
export type AdminAddStoreCurrenciesBody = z.infer<typeof AdminAddStoreCurrencies>
