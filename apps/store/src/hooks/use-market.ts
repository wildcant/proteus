import { useRouter } from '@tanstack/react-router'
import type { MarketContext } from '#/lib/market'

/**
 * The market this router is serving, and the markets it can be switched to.
 *
 * Read from the router's context rather than a route's, and without a subscription, because the
 * market cannot change under a mounted component: the rewrite is fixed when the router is created,
 * so switching market is a document navigation that builds a new one. A hook that re-rendered on
 * change would be promising something the design deliberately does not do.
 */
export function useMarket(): MarketContext {
  return useRouter().options.context.market
}
