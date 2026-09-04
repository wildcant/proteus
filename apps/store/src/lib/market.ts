/**
 * A Market is the country a shopper is shopping in, named by its locale code. The locale code is
 * one field doing three jobs: the URL segment, the document language attribute, and the tag every
 * number and date formatter is handed.
 *
 * Everything here is pure and isomorphic — the server resolves a market per request, the client
 * reads the one the server resolved, and both need the same parsing.
 */

/**
 * The market served without a URL prefix, and the one every fallback lands on.
 *
 * Compiled in rather than fetched because it is the answer when the fetch itself fails: a default
 * that can only be learned from the country endpoint is no default at all. The backend owns which
 * markets exist; this owns only which one a storefront with no other information shows.
 */
export const DEFAULT_LOCALE_CODE = 'en-US'

/** Where the resolved locale code is persisted, so a later visit to `/` lands on the same market. */
export const MARKET_COOKIE = 'proteus_store_market'

/** A year: the market is a preference, not a session, and re-choosing it every month is noise. */
const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * What `getRouter` hands the rewrite, the document and the shell script.
 *
 * `localeCode` is mutable because the rewrite's `input` is what discovers it: the router parses
 * the location after it is created, so the market is not known at construction time. One object
 * per router, and the server builds a router per request, so nothing is shared across shoppers.
 */
export type MarketContext = {
  /** The market this router is serving. */
  localeCode: string
  /** Every locale code that is a routable URL segment. Anything else is a not-found. */
  localeCodes: ReadonlyArray<string>
}

/** The global the server writes into the document so the client router resolves the same market. */
export const MARKET_GLOBAL = '__PROTEUS_MARKET__'

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: augmenting a global needs an interface
  interface Window {
    [MARKET_GLOBAL]?: { localeCode: string; localeCodes: Array<string> }
  }
}

/**
 * Splits a `/<localeCode>/rest` pathname into its market and the path the router should match.
 *
 * Returns `undefined` when the first segment is not a routable market — which is how an unknown
 * segment reaches the router unchanged and comes back as a not-found rather than a redirect.
 * Redirecting would mint duplicate content at unbounded URLs.
 */
export function splitMarketSegment(
  pathname: string,
  localeCodes: ReadonlyArray<string>,
): { localeCode: string; rest: string } | undefined {
  const [, first = '', ...remainder] = pathname.split('/')
  if (!localeCodes.includes(first)) return undefined
  return { localeCode: first, rest: `/${remainder.join('/')}` }
}

/** Prefixes a router pathname with a market segment. The inverse of `splitMarketSegment`. */
export function joinMarketSegment(localeCode: string, pathname: string): string {
  return pathname === '/' ? `/${localeCode}` : `/${localeCode}${pathname}`
}

/** Reads the persisted market out of a `Cookie` header. Returns undefined when it is not set. */
export function readMarketCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=')
    if (separator === -1) continue
    if (pair.slice(0, separator).trim() !== MARKET_COOKIE) continue
    return decodeURIComponent(pair.slice(separator + 1).trim())
  }
  return undefined
}

/**
 * The `Set-Cookie` value that persists a market.
 *
 * `HttpOnly` because nothing in the browser reads it — the market a page is showing is in its own
 * URL. `Secure` only over https, or the cookie is dropped on a plain-http development origin.
 */
export function marketCookie(localeCode: string, secure: boolean): string {
  const attributes = [
    `${MARKET_COOKIE}=${encodeURIComponent(localeCode)}`,
    'Path=/',
    `Max-Age=${MARKET_COOKIE_MAX_AGE}`,
    'SameSite=Lax',
    'HttpOnly',
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}
