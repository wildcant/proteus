import { NativeSelectOption } from '@proteus/ui'

/**
 * The countries the storefront ships to.
 *
 * There is no region or country table behind this yet, so the list is a constant rather than a
 * query. It lives in one place because checkout and the address book have to agree on it: a
 * country a shopper can save but not check out to is worse than one they cannot save.
 */
const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'ca', name: 'Canada' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'au', name: 'Australia' },
  { code: 'se', name: 'Sweden' },
  { code: 'dk', name: 'Denmark' },
]

export function CountryOptions() {
  return (
    <>
      {COUNTRIES.map((country) => (
        <NativeSelectOption key={country.code} value={country.code}>
          {country.name}
        </NativeSelectOption>
      ))}
    </>
  )
}
