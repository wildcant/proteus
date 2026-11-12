import { createMiddleware, createStart } from '@tanstack/react-start'
import { loadSellableMarkets } from '#/api/sellable-markets'
import {
  joinMarketSegment,
  looksLikeMarketSegment,
  readMarketCookie,
  readShopperCountry,
  resolveMarketTarget,
  splitMarketSegment,
} from '#/lib/market'

/**
 * Resolves the market for every document request: URL first, then the persisted cookie, then the
 * country Cloudflare places the shopper in, then the store default.
 *
 * It sits in front of the router rather than in a route's `beforeLoad` because its answer is an
 * HTTP answer — a redirect to the market a returning shopper chose. Doing it in the router would
 * mean rendering a page to find out we should not have.
 *
 * A page itself is the same for every shopper: its market is in its URL, and it remembers that
 * market from the document (see `marketCookieScript`) rather than with a `Set-Cookie`, so the
 * Worker's cache can keep the page and serve it without running the Worker.
 *
 * Every market is prefixed, the default one included, so `/` is a router and never a page. The
 * alternative — serving the default market unprefixed — puts the same content at two addresses
 * and leaves every later slice knowing that one market is spelled differently from the rest.
 */
const marketMiddleware = createMiddleware({ type: 'request' }).server(async ({ request, next, handlerType }) => {
  // Server function calls carry the market in their own URL and must not be redirected out from
  // under the page that issued them.
  if (handlerType !== 'router') return next()

  const { markets, defaultMarket } = await loadSellableMarkets()
  const url = new URL(request.url)

  // The URL names the market, so there is nothing to resolve.
  if (splitMarketSegment(url.pathname, markets)) return next()

  // A market asked for by name that the store does not sell in. Not a path missing its prefix, so
  // there is nowhere to send the shopper that answers what they asked: the router gets it
  // unchanged and returns not-found at the address they typed.
  if (looksLikeMarketSegment(url.pathname)) return next()

  // A first visit lands on the shopper's own market rather than the default. The redirect points
  // at a segment URL, and the page there is what persists it, so geo is consulted once.
  const target = resolveMarketTarget({
    cookie: readMarketCookie(request.headers.get('cookie')),
    country: readShopperCountry(request),
    markets,
    defaultMarket,
  })

  url.pathname = joinMarketSegment(target, url.pathname)
  // `no-store` because where this redirect points is one shopper's answer: a cache that kept it
  // would send the next shopper to someone else's market.
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), 'cache-control': 'no-store' },
  })
})

export const startInstance = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [marketMiddleware],
}))
