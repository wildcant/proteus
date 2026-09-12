import type { AdminCountry } from '#/api/generated/model'

/** One country as the Add-countries form holds it while the merchant fills it in. */
export type CountryAssignment = {
  /** ISO 3166-1 alpha-2, lowercased. */
  id: string
  localeCode: string
}

/**
 * The countries the picker may offer: the ones no region has claimed.
 *
 * A country belongs to exactly one region, so offering an assigned one would be offering to close
 * another market — the API refuses it, and a picker that showed it would turn that refusal into an
 * error a merchant cannot act on from this screen. Countries already in *this* region are excluded
 * by the same rule; they are already listed in the table underneath.
 */
export function selectableCountries(countries: AdminCountry[]): AdminCountry[] {
  return countries.filter((country) => country.regionId === null)
}

/**
 * The locale to start a country off with, or `null` when nothing can be inferred.
 *
 * `Intl.Locale.maximize()` is CLDR's likely-subtags table: `und-CO` resolves to `es-Latn-CO`, which
 * is the tag that formats a Colombian peso as `$ 1.234` where a derived `en-CO` would print
 * `COP 1,234`. The guess is a starting point and nothing more — the merchant owns the field,
 * because a country with several official languages has several right answers and CLDR only knows
 * the most common one.
 *
 * The region check is what makes an unknown code produce no suggestion rather than a wrong one:
 * `und-ZZ` maximizes to `en-Latn-US`, a locale that has nothing to do with the code asked about.
 */
function suggestLocaleCode(iso2: string): string | null {
  const region = iso2.toUpperCase()

  try {
    const likely = new Intl.Locale(`und-${region}`).maximize()
    if (likely.region !== region) return null
    return `${likely.language}-${region}`
  } catch {
    // An code that is not a well-formed subtag at all. Nothing to suggest; the field stays empty.
    return null
  }
}

/**
 * Reconciles the form's rows with the picker's selection: new countries arrive with a suggested
 * locale, deselected ones drop out, and a locale the merchant already edited survives both.
 */
export function reconcileAssignments(current: CountryAssignment[], selectedIds: string[]): CountryAssignment[] {
  const byId = new Map(current.map((country) => [country.id, country]))

  return selectedIds.map((id) => byId.get(id) ?? { id, localeCode: suggestLocaleCode(id) ?? '' })
}
