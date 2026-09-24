import type { AnyRouteMatch } from '@tanstack/react-router'
import { joinMarketSegment, type MarketContext } from '#/lib/market'

/** One `<link>` in a route's `head().links`. */
export type HeadLink = { rel: 'canonical'; href: string } | { rel: 'alternate'; hrefLang: string; href: string }

/**
 * The links that tell a search engine how one page's market addresses relate.
 *
 * Canonical is the page's own address, so `/en-US/products/shirt` and `/es-CO/products/shirt` are
 * two pages rather than duplicates of each other. One alternate per sellable market points at the
 * same path under that market's segment. `x-default` is `/`, so a searcher matching no alternate
 * goes through the redirect — cookie, then geo-IP — rather than being pinned to one market.
 *
 * `pathname` is the router's path, with no market segment: the rewrite has already stripped it.
 * Search is left off on purpose — it carries modal state, not a different page.
 *
 * A page no market was resolved for is one the router answers with a not-found, and a not-found
 * has no address worth declaring, so it gets nothing.
 */
function marketHeadLinks(market: MarketContext, pathname: string): Array<HeadLink> {
  if (!market.resolvedFromUrl) return []
  return [
    { rel: 'canonical', href: joinMarketSegment(market.current.localeCode, pathname) },
    ...market.markets.map(
      (candidate): HeadLink => ({
        rel: 'alternate',
        hrefLang: candidate.localeCode,
        href: joinMarketSegment(candidate.localeCode, pathname),
      }),
    ),
    { rel: 'alternate', hrefLang: 'x-default', href: '/' },
  ]
}

/**
 * `marketHeadLinks` for a route's `head()`, addressed by the leaf match.
 *
 * The leaf rather than the route's own match because a layout's own pathname is its prefix, not
 * the page being shown. Every route that declares these therefore declares the same tags, and the
 * router drops identical tags, so the page carries one set whichever routes are on its path.
 * `head()` re-runs on every load, so the set follows client navigation.
 */
export function marketHeadLinksFor({
  match,
  matches,
}: {
  match: { context: { market: MarketContext } }
  matches: ReadonlyArray<Pick<AnyRouteMatch, 'pathname'>>
}): Array<HeadLink> {
  return marketHeadLinks(match.context.market, matches.at(-1)?.pathname ?? '/')
}
