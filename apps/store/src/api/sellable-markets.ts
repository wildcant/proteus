import { StoreCountryListResponse } from '@proteus/http-schemas/store'
import { createIsomorphicFn } from '@tanstack/react-start'
import { listStoreCountries } from '#/api/generated/countries/countries'
import { DEFAULT_MARKET, MARKET_GLOBAL, type Market, type SellableMarkets } from '#/lib/market'

/**
 * Which markets the store sells in, and therefore which locale codes are routable URL segments.
 *
 * The set is data, not a constant: it is exactly the countries the store sells to, and adding a
 * market must not need a storefront release. So the server reads it from the country endpoint and
 * the client reads what the server already resolved, out of the document.
 *
 * A whole country record per market rather than its locale code alone, because three different
 * readers need three different fields of the same row: the router matches on `localeCode`, priced
 * requests are made with `iso2`, and the market control lists `displayName`.
 *
 * The default market comes back beside the set, from the same answer: it is the country behind
 * `store.defaultRegionId`, so a merchant who moves the default does not need a storefront release
 * either. `DEFAULT_MARKET` is only what the store serves when the backend cannot be reached.
 */

/** How long a successful listing is trusted. A market is added by a merchant, not by a request. */
const FRESH_TTL_MS = 5 * 60 * 1000

/**
 * How long a fallback is trusted. Shorter than a success on purpose: a fallback means the backend
 * was unreachable, and holding that answer for five minutes turns a blip into an outage.
 */
const FALLBACK_TTL_MS = 30 * 1000

type CacheEntry = { sellable: SellableMarkets; expiresAt: number }

/** What the store serves while the backend is unreachable: the compiled market, alone. */
const FALLBACK: SellableMarkets = { markets: [DEFAULT_MARKET], defaultMarket: DEFAULT_MARKET }

/**
 * A backend that answers but names no default market. Not a blip, so it must not be papered over
 * with the fallback: the store would quote prices in a market nobody configured as the default.
 */
class NoDefaultMarketError extends Error {}

/**
 * Module scope, so it is one fetch per server instance rather than one per render — the same
 * caching the pricing middleware uses for its region map. `inFlight` collapses the requests that
 * arrive together on a cold instance into that single fetch.
 */
let cache: CacheEntry | undefined
let inFlight: Promise<SellableMarkets> | undefined

/** A country row narrowed to a market: null when it carries no locale or currency, i.e. is not sellable. */
function toMarket(country: StoreCountryListResponse['countries'][number]): Market | null {
  return country.localeCode && country.currencyCode
    ? {
        localeCode: country.localeCode,
        iso2: country.iso2,
        displayName: country.displayName,
        currencyCode: country.currencyCode,
      }
    : null
}

async function fetchMarkets(): Promise<SellableMarkets> {
  // Parsed and not merely typed: the generated client asserts the body's shape without checking
  // it, and this one answer routes every document request, is held for minutes and is serialised
  // into the page. A payload that does not match belongs in the fallback below, not in the router.
  const { countries, defaultMarket } = StoreCountryListResponse.parse(await listStoreCountries({ scope: 'sellable' }))
  // A sellable country always carries a locale code and a currency — both come from the region
  // that makes it sellable, and the seed fails naming the country when the locale is missing — so
  // this filter is a type narrowing, not a silent drop.
  const markets = countries.flatMap((country) => toMarket(country) ?? [])
  const fetchedDefault = defaultMarket ? toMarket(defaultMarket) : null

  // Loud on the server rather than silently serving some other market as the default. An
  // unreachable backend is a different thing and is handled below; this is a misconfiguration
  // and has to surface as one.
  if (!fetchedDefault) {
    throw new NoDefaultMarketError(
      'The store has no default market: set a default region that sells to at least one country.',
    )
  }

  // The same object the set holds, so the router and the redirect compare one market, not two copies.
  // Matched on `iso2`, the country key: two sellable countries can share a locale code.
  return {
    markets,
    defaultMarket: markets.find((market) => market.iso2 === fetchedDefault.iso2) ?? fetchedDefault,
  }
}

async function loadOnServer(): Promise<SellableMarkets> {
  if (cache && cache.expiresAt > Date.now()) return cache.sellable
  if (inFlight) return inFlight

  inFlight = fetchMarkets()
    .then((sellable) => {
      cache = { sellable, expiresAt: Date.now() + FRESH_TTL_MS }
      return sellable
    })
    .catch((error: unknown) => {
      // The store stays up on the market it can always serve. Rethrowing here would turn a
      // backend blip into a blank storefront, and the default market is the one page that is
      // certain to be correct.
      if (error instanceof NoDefaultMarketError) throw error
      // `info` because it is the channel this repo allows, not because it is minor: the store is
      // running degraded until the next attempt succeeds.
      console.info('Falling back to the default market: could not list the store countries.', error)
      cache = { sellable: FALLBACK, expiresAt: Date.now() + FALLBACK_TTL_MS }
      return FALLBACK
    })
    .finally(() => {
      inFlight = undefined
    })

  return inFlight
}

/**
 * The markets this router can route to, and the one a shopper with no market of their own lands on.
 *
 * On the client this is a read, never a fetch: the server wrote what it resolved into the document
 * before the entry module runs, so hydration costs no round trip and cannot disagree with the
 * markup it is hydrating.
 */
export const loadSellableMarkets = createIsomorphicFn()
  .server(loadOnServer)
  .client(async (): Promise<SellableMarkets> => window[MARKET_GLOBAL] ?? FALLBACK)
