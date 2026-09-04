import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { DEFAULT_LOCALE_CODE, joinMarketSegment, type MarketContext, splitMarketSegment } from '#/lib/market'
import { loadMarketLocaleCodes } from '#/lib/market-locales'
import { routeTree } from './routeTree.gen'

export async function getRouter() {
  const queryClient = new QueryClient()

  const localeCodes = await loadMarketLocaleCodes()
  // One per router, and the server builds a router per request, so this is request state even
  // though the rewrite closes over it. `input` fills in the market; see below.
  const market: MarketContext = { localeCode: DEFAULT_LOCALE_CODE, localeCodes }

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, market },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // The market rides in the URL the browser shows, not in the route tree. Splitting the two
    // here keeps every route file, every generated route id and every typed navigation call site
    // exactly as it was — the alternative, a `$localeCode` directory, rewrites all three.
    rewrite: {
      // Browser URL -> the path the router matches. Discovering the market is a side effect of
      // parsing the location, which is the only moment the router knows what it is being asked
      // for. An unroutable first segment is left alone so it reaches the route tree and comes
      // back as a not-found rather than a redirect to somewhere plausible.
      input: ({ url }) => {
        const split = splitMarketSegment(url.pathname, market.localeCodes)
        if (!split) return undefined
        market.localeCode = split.localeCode
        url.pathname = split.rest
        return url
      },
      // The path the router built -> the URL the browser shows. Nothing is returned for the
      // default market, so it keeps the unprefixed URLs it has today and provably takes the same
      // path through the router that it does now.
      output: ({ url }) => {
        if (market.localeCode === DEFAULT_LOCALE_CODE) return undefined
        url.pathname = joinMarketSegment(market.localeCode, url.pathname)
        return url
      },
    },
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    // Awaited: the router is built after the routable market set is read, so `getRouter` is async.
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
