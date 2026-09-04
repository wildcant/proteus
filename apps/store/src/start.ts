import { createMiddleware, createStart } from '@tanstack/react-start'
import {
  DEFAULT_LOCALE_CODE,
  joinMarketSegment,
  marketCookie,
  readMarketCookie,
  splitMarketSegment,
} from '#/lib/market'
import { loadMarketLocaleCodes } from '#/lib/market-locales'

/**
 * What a document request answers with now depends on the market cookie, and the product list
 * declares `Cache-Control: public, max-age=300`. Without this, a browser that has already cached
 * `/` in the default market replays it after the shopper has chosen another one, and the redirect
 * below never runs — the request never reaches the server at all.
 */
function withCookieVary<T extends { response: Response }>(result: T): T {
  result.response.headers.append('vary', 'Cookie')
  return result
}

/**
 * Resolves the market for every document request: URL first, then the persisted cookie, then the
 * store default.
 *
 * It sits in front of the router rather than in a route's `beforeLoad` because the two answers it
 * gives are HTTP answers — a redirect to the market a returning shopper chose, and the `Set-Cookie`
 * that remembers the one they are looking at. Doing it in the router would mean rendering a page
 * to find out we should not have.
 */
const marketMiddleware = createMiddleware({ type: 'request' }).server(async ({ request, next, handlerType }) => {
  // Server function calls carry the market in their own URL and must not be redirected out from
  // under the page that issued them.
  if (handlerType !== 'router') return next()

  const localeCodes = await loadMarketLocaleCodes()
  const url = new URL(request.url)
  const fromUrl = splitMarketSegment(url.pathname, localeCodes)

  if (fromUrl) {
    // Choosing a market by its URL is what persists it, so a later visit to `/` lands there.
    const result = await next()
    result.response.headers.append('set-cookie', marketCookie(fromUrl.localeCode, url.protocol === 'https:'))
    return withCookieVary(result)
  }

  const remembered = readMarketCookie(request.headers.get('cookie'))
  // A cookie naming a market the store no longer sells in is stale, not fatal — drop back to the
  // default rather than showing a shopper a not-found for a link that used to work.
  if (!remembered || remembered === DEFAULT_LOCALE_CODE || !localeCodes.includes(remembered)) {
    return withCookieVary(await next())
  }

  url.pathname = joinMarketSegment(remembered, url.pathname)
  // `vary` for the same reason as above, and `no-store` because where this redirect points is one
  // shopper's answer: a cache that kept it would send the next shopper to someone else's market.
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), vary: 'Cookie', 'cache-control': 'no-store' },
  })
})

export const startInstance = createStart(() => ({
  defaultSsr: false,
  requestMiddleware: [marketMiddleware],
}))
