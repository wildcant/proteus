/**
 * The countries the storefront ships to.
 *
 * There is no region or country table behind this yet, so the list is a constant rather than a
 * query. It lives in one place because checkout and the address book have to agree on it: a
 * country a shopper can save but not check out to is worse than one they cannot save.
 *
 * In its own module rather than beside `CountryOptions`, because Fast Refresh only works when a
 * file exports components alone and `countryName` is not one.
 */
export const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'au', name: 'Australia' },
  { code: 'se', name: 'Sweden' },
  { code: 'dk', name: 'Denmark' },
]

/**
 * The country's display name, for the surfaces that print an address rather than capture one —
 * an order's delivery panel reads `us` off the wire and a shopper reads "United States".
 *
 * Falls back to the uppercased code so an order placed before a country left the list still
 * renders, rather than showing a blank line where a country was.
 */
export function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code.toLowerCase())?.name ?? code.toUpperCase()
}
