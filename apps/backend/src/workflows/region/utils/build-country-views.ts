import type { CountryDTO } from '@core/types/region/common.js'
import type { AdminCountry } from '@proteus/http-schemas/admin'

/**
 * Narrows a country row to what the admin's country screens read.
 *
 * The ISO table carries five identifiers per country — alpha-2, alpha-3, the numeric code, the
 * official name and the display name — and the screens use exactly one of each pair: the alpha-2
 * code the row is keyed by, and the display name a merchant recognises. `regionId` is here because
 * it is what the picker filters on, not because a screen prints it.
 */
export function buildCountryView(country: CountryDTO): AdminCountry {
  return {
    id: country.id,
    displayName: country.displayName,
    regionId: country.regionId,
    localeCode: country.localeCode,
  }
}

export function buildCountryViews(countries: CountryDTO[]): AdminCountry[] {
  return countries.map(buildCountryView)
}
