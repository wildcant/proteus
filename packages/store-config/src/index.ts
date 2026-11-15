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
 * The share of an Order's total a store asks for as a deposit, as a percentage (`30` for 30 %). The
 * admin prefills an Order's first recorded payment with it; unset, there is no prefill.
 */
export const DEPOSIT_PERCENTAGE: number | undefined = undefined

/**
 * What an Order's reference starts with, separator included (`'PDJ-'` reads «PDJ-1042»). Unset, the
 * reference is the bare display id.
 */
export const ORDER_REFERENCE_PREFIX: string | undefined = undefined

/** Whether the storefront may turn a Cart into a Draft Order, for a store that confirms orders in a chat. */
export const STORE_DRAFT_ORDERS_ENABLED: boolean = false
