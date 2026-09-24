/**
 * A Market is the country a shopper is shopping in. It carries four fields and each does a
 * different job: `localeCode` is the URL segment, the document language attribute, and the tag
 * every number and date formatter is handed; `iso2` is what the store API selects a region — and
 * therefore a currency — by; `displayName` is what the market control shows; `currencyCode` is
 * the money this market settles in, which is how a page can tell that the cart it is holding
 * belongs to another one.
 *
 * They travel together because they are one row of the country endpoint's answer, and splitting
 * them into four lists would mean four chances to hand one market's name to another's prices.
 *
 * Everything here is pure and isomorphic — the server resolves a market per request, the client
 * reads the one the server resolved, and both need the same parsing.
 */
export type Market = {
  /** BCP 47 tag, e.g. `es-CO`. The URL segment, the language attribute and the formatting tag. */
  localeCode: string
  /** ISO 3166-1 alpha-2, lowercased. What the store API prices a request in. */
  iso2: string
  /** The country as a shopper reads it. What the market control lists. */
  displayName: string
  /**
   * ISO 4217, lowercased, from the region behind this country. Never sent anywhere — the region
   * decides what a request is priced in — it is read to compare against the currency a cart is
   * already carrying, which is the one market signal a cart's own response exposes.
   */
  currencyCode: string
}

/**
 * The market served when the backend cannot be reached, and the one every such fallback lands on.
 *
 * Compiled in because it is the answer when the fetch itself fails. When the backend answers, the
 * default is the country behind `store.defaultRegionId` instead — see `SellableMarkets`.
 */
export const DEFAULT_MARKET: Market = {
  localeCode: 'en-US',
  iso2: 'us',
  displayName: 'United States',
  currencyCode: 'usd',
}

/**
 * The country endpoint's answer as the store holds it: every routable market, and the one a
 * shopper with no market of their own is sent to. The default is one of `markets`.
 */
export type SellableMarkets = {
  markets: Array<Market>
  defaultMarket: Market
}

/** Where the resolved locale code is persisted, so a later visit to `/` lands on the same market. */
const MARKET_COOKIE = 'proteus_store_market'

/** A year: the market is a preference, not a session, and re-choosing it every month is noise. */
const MARKET_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/**
 * What `getRouter` hands the rewrite, the document, the shell script and every priced request.
 *
 * `current` is mutable because the rewrite's `input` is what discovers it: the router parses the
 * location after it is created, so the market is not known at construction time. One object per
 * router, and the server builds a router per request, so nothing is shared across shoppers.
 */
export type MarketContext = {
  /** The market this router is serving. */
  current: Market
  /** Every market the store sells in: the routable URL segments, and the control's options. */
  markets: ReadonlyArray<Market>
  /** The market `current` stands at until the URL names one. From the backend, not compiled in. */
  defaultMarket: Market
  /**
   * Whether `current` came from the URL or is still the default standing in for one.
   *
   * `output` prefixes only when this is true. A path the router is answering with a not-found
   * never resolved a market, and prefixing it would move the not-found to `/en-US/fr-FR` — a
   * second address for the same nothing, and no longer the address the shopper typed.
   */
  resolvedFromUrl: boolean
}

/**
 * The global the server writes into the document so the client router resolves the same markets.
 *
 * The routable set only — not which market the document is in. That one the client reads out of
 * its own URL, the same way the server did, so there is no second answer in the page that a later
 * navigation could leave stale.
 */
export const MARKET_GLOBAL = '__PROTEUS_MARKET__'

declare global {
  // biome-ignore lint/style/useConsistentTypeDefinitions: augmenting a global needs an interface
  interface Window {
    [MARKET_GLOBAL]?: SellableMarkets
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
  markets: ReadonlyArray<Market>,
): { market: Market; rest: string } | undefined {
  const [, first = '', ...remainder] = pathname.split('/')
  const market = markets.find((candidate) => candidate.localeCode === first)
  if (!market) return undefined
  return { market, rest: `/${remainder.join('/')}` }
}

/** Prefixes a router pathname with a market segment. The inverse of `splitMarketSegment`. */
export function joinMarketSegment(localeCode: string, pathname: string): string {
  return pathname === '/' ? `/${localeCode}` : `/${localeCode}${pathname}`
}

/**
 * The address the same page has in another market: same path, same search, different segment.
 *
 * Takes the browser's URL rather than the router's, because the segment has to be swapped on the
 * address a document request will be made to — and it is the browser's URL that carries one at all.
 * A path that has no market segment yet keeps all of itself, so nothing is lost switching from an
 * address the middleware has not placed.
 */
export function marketHref(
  localeCode: string,
  location: { pathname: string; search: string },
  markets: ReadonlyArray<Market>,
): string {
  const split = splitMarketSegment(location.pathname, markets)
  return `${joinMarketSegment(localeCode, split?.rest ?? location.pathname)}${location.search}`
}

/**
 * Whether a path's first segment is shaped like a market, whether or not the store sells in one.
 *
 * This is what separates the two ways a URL can arrive without a market. `/products` is a path
 * missing its prefix, and the shopper is sent to the market they belong in. `/fr-FR` is a market
 * being asked for by name — if the store does not sell there, the honest answer is not-found at
 * that address. Redirecting it to `/en-US/fr-FR` would answer a question nobody asked, and mint a
 * second URL for the same nothing.
 *
 * No route in the storefront is shaped this way, and none can be: a locale code is the one segment
 * the router never owns.
 */
export function looksLikeMarketSegment(pathname: string): boolean {
  const [, first = ''] = pathname.split('/')
  return /^[a-z]{2}-[A-Z]{2}$/.test(first)
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

/**
 * Which market a request with no market in its URL is sent to: the one the shopper chose last
 * time, then the one for the country they are in, then the store's default market.
 *
 * A remembered market is an explicit choice, so it outranks where the shopper happens to be. A
 * cookie naming a market the store no longer sells in is stale, not a choice, so it gives way to
 * the country rather than to the default. The country is matched against `iso2` whatever its case
 * — Cloudflare reports it uppercase — and anything that names no sellable market (`XX` for
 * unknown, `T1` for Tor, a country the store does not ship to, none at all) simply matches nothing.
 */
export function resolveMarketTarget({
  cookie,
  country,
  markets,
  defaultMarket,
}: {
  cookie: string | undefined
  country: string | undefined
  markets: ReadonlyArray<Market>
  defaultMarket: Market
}): string {
  if (cookie && markets.some((market) => market.localeCode === cookie)) return cookie
  const iso2 = country?.toLowerCase()
  const local = iso2 ? markets.find((market) => market.iso2 === iso2) : undefined
  return local?.localeCode ?? defaultMarket.localeCode
}

/**
 * The country Cloudflare's edge geo-IP placed the request in, or undefined off the edge.
 *
 * `cf.country` first because it is the Workers runtime's own answer. `CF-IPCountry` second because
 * the request a framework middleware receives may be a copy that dropped `cf`; the header survives
 * the copy, and Cloudflare sets it on every proxied request when IP Geolocation is on. Both are
 * written by the edge, so a local server has neither and resolves exactly as it did before.
 */
export function readShopperCountry(request: Request & { cf?: { country?: unknown } }): string | undefined {
  const fromCf = request.cf?.country
  if (typeof fromCf === 'string' && fromCf) return fromCf
  return request.headers.get('cf-ipcountry') ?? undefined
}
