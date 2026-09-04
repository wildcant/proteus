import { StoreCountryListResponse } from '@proteus/http-schemas/store'
import { createIsomorphicFn } from '@tanstack/react-start'
import { env } from '#/env'
import { DEFAULT_LOCALE_CODE, MARKET_GLOBAL } from '#/lib/market'

/**
 * Which locale codes are routable URL segments.
 *
 * The set is data, not a constant: it is exactly the locale codes on the countries the store sells
 * to, and adding a market must not need a storefront release. So the server reads it from the
 * country endpoint and the client reads what the server already resolved, out of the document.
 */

/** How long a successful listing is trusted. A market is added by a merchant, not by a request. */
const FRESH_TTL_MS = 5 * 60 * 1000

/**
 * How long a fallback is trusted. Shorter than a success on purpose: a fallback means the backend
 * was unreachable, and holding that answer for five minutes turns a blip into an outage.
 */
const FALLBACK_TTL_MS = 30 * 1000

type CacheEntry = { codes: Array<string>; expiresAt: number }

/**
 * Module scope, so it is one fetch per server instance rather than one per render — the same
 * caching the pricing middleware uses for its region map. `inFlight` collapses the requests that
 * arrive together on a cold instance into that single fetch.
 */
let cache: CacheEntry | undefined
let inFlight: Promise<Array<string>> | undefined

async function fetchLocaleCodes(): Promise<Array<string>> {
  const response = await fetch(new URL('/store/countries', env.VITE_BACKEND_URL))
  if (!response.ok) throw new Error(`GET /store/countries failed: ${response.status}`)

  const { countries } = StoreCountryListResponse.parse(await response.json())
  // A sellable country always carries a locale code — the seed fails naming the country when one
  // does not — so this filter is a type narrowing, not a silent drop.
  const codes = [...new Set(countries.flatMap((country) => (country.localeCode ? [country.localeCode] : [])))]

  // Loud on the server rather than silently serving a market the backend does not sell in, which
  // would quote prices in a currency nobody configured. An unreachable backend is a different
  // thing and is handled below; this is a misconfiguration and has to surface as one.
  if (!codes.includes(DEFAULT_LOCALE_CODE)) {
    throw new Error(
      `The store does not sell in its default market "${DEFAULT_LOCALE_CODE}". Sellable markets: ${
        codes.length ? codes.join(', ') : '(none)'
      }.`,
    )
  }

  return codes
}

async function loadOnServer(): Promise<Array<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.codes
  if (inFlight) return inFlight

  inFlight = fetchLocaleCodes()
    .then((codes) => {
      cache = { codes, expiresAt: Date.now() + FRESH_TTL_MS }
      return codes
    })
    .catch((error: unknown) => {
      // The store stays up on the market it can always serve. Rethrowing here would turn a
      // backend blip into a blank storefront, and the default market is the one page that is
      // certain to be correct.
      if (error instanceof Error && error.message.startsWith('The store does not sell')) throw error
      // `info` because it is the channel this repo allows, not because it is minor: the store is
      // running degraded until the next attempt succeeds.
      console.info('Falling back to the default market: could not list the store countries.', error)
      const codes = [DEFAULT_LOCALE_CODE]
      cache = { codes, expiresAt: Date.now() + FALLBACK_TTL_MS }
      return codes
    })
    .finally(() => {
      inFlight = undefined
    })

  return inFlight
}

/**
 * The routable locale codes for this router.
 *
 * On the client this is a read, never a fetch: the server wrote what it resolved into the document
 * before the entry module runs, so hydration costs no round trip and cannot disagree with the
 * markup it is hydrating.
 */
export const loadMarketLocaleCodes = createIsomorphicFn()
  .server(loadOnServer)
  .client(async (): Promise<Array<string>> => window[MARKET_GLOBAL]?.localeCodes ?? [DEFAULT_LOCALE_CODE])
