import { z } from 'zod'
import { countryCode, entityId, MAX_ITEMS, machineCode, shortText } from '../../bounded.js'

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

/**
 * The BCP 47 tag a country's storefront runs on — its URL segment, its `lang` attribute, and the
 * tag every number and date formatter there is given.
 *
 * Trimmed before it is required, so a tag of spaces is refused rather than stored: `country.locale_code`
 * is asserted to be set exactly when `region_id` is, and a country that is sellable with no usable
 * locale is a market whose prices and dates cannot be formatted at all.
 *
 * Non-empty is not enough, because this is a field a merchant retypes. `es_CO` — the POSIX form,
 * and the most ordinary locale typo there is — is five characters and passes every length check,
 * and what it produces downstream is not a mis-formatted price but a dead market: the storefront
 * lists the country as sellable, hands the tag to `new Intl.NumberFormat(…)`, and every priced page
 * in that market throws `RangeError: Incorrect locale information provided` with no error boundary
 * above it.
 *
 * The check is `Intl.getCanonicalLocales` rather than a pattern for exactly the reason a pattern
 * looked impossible: BCP 47 admits far more than `language-REGION`, and any expression short enough
 * to read would refuse tags a merchant legitimately needs. `Intl` implements that grammar and
 * nothing beyond it, so `en`, `pt-BR`, `sr-Latn-RS`, `ca-ES-valencia`, `en-US-u-ca-gregory` and
 * `es-419` all pass. It narrows the field to what a formatter can actually be given, and no
 * further. It is also the one function every runtime this schema loads in already ships, so the
 * form refuses the typo in the browser with the field named, and the route refuses it again.
 */
const localeCode = machineCode
  .trim()
  .min(1)
  .refine((tag) => {
    try {
      Intl.getCanonicalLocales(tag)
      return true
    } catch {
      return false
    }
  }, 'Not a well-formed BCP 47 language tag')

/** ISO 3166-1 alpha-2, lowercased on the way in so `CO` and `co` name the same country row. */
const countryIso2 = countryCode.min(2).transform((code) => code.toLowerCase())

/**
 * Which countries a region sells to, and in what locale each of them reads.
 *
 * The locale travels with the country rather than being a second request, because that pairing is
 * the invariant: assigning a region is what makes a country sellable, and a sellable country with
 * no locale is a storefront with no URL segment and no formatter. Refusing the assignment is the
 * only place that can be enforced — the form is a convenience, not a guarantee.
 */
export const AdminAssignRegionCountries = z
  .object({
    countries: z
      .array(
        z.object({
          id: countryIso2,
          localeCode,
        }),
      )
      .min(1)
      .max(MAX_ITEMS.batch),
  })
  .openapi('AdminAssignRegionCountries')
export type AdminAssignRegionCountriesBody = z.infer<typeof AdminAssignRegionCountries>

/**
 * Repointing one country's locale, without touching the region it belongs to.
 *
 * Its own payload rather than a partial of the assignment above: the locale is the one field of a
 * live market a merchant can get wrong and repair, and the form that does it warns that the
 * storefront URLs it is about to change are already in use.
 */
export const AdminUpdateCountryLocale = z
  .object({
    localeCode,
  })
  .openapi('AdminUpdateCountryLocale')
export type AdminUpdateCountryLocaleBody = z.infer<typeof AdminUpdateCountryLocale>
