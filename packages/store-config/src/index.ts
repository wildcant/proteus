/**
 * Who the store is and where it sells: the one file a store built from this codebase rewrites to
 * become itself. The backend seeds its store and markets from it, and the storefront falls back to
 * its first market when the backend cannot be reached.
 */

type Country = {
  /** ISO 3166-1 alpha-2, lowercased. */
  iso2: string
  /** BCP 47. The storefront's URL segment for this country, and what it formats prices and dates with. */
  localeCode: string
  /** The country as a shopper reads it. */
  displayName: string
}

export type Market = {
  name: string
  /** ISO 4217, lowercased. */
  currencyCode: string
  countries: [Country, ...Country[]]
}

/** What the storefront's title and the backend's store record are called. */
export const STORE_NAME = 'Proteus'

/** Every market the store sells in. The first one, and its first country, is the default. */
export const MARKETS: [Market, ...Market[]] = [
  {
    name: 'United States',
    currencyCode: 'usd',
    countries: [{ iso2: 'us', localeCode: 'en-US', displayName: 'United States' }],
  },
  {
    name: 'Colombia',
    currencyCode: 'cop',
    countries: [{ iso2: 'co', localeCode: 'es-CO', displayName: 'Colombia' }],
  },
]

/**
 * The storefront filter whose values are colours, `option.<title>` for a product option or a field's
 * key: its values each carry a swatch key, and no other filter's do.
 */
export const COLOR_FILTER_KEY = 'option.Color'
