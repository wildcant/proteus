import { type ProductListSearch, productListSearchSchema } from '#/features/products/utils/product-list-search'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

/**
 * The search params a product list loader reads — every one, because a param the loader does not
 * see is a param the server renders the wrong value for: a cold hit on `?offset=24` would otherwise
 * be SSR'd as page 1. Picked rather than the whole search, which carries the root's `modal` too.
 */
const productListLoaderDeps = ({ search }: { search: ProductListSearch }) => ({
  q: search.q,
  tag: search.tag,
  filter: search.filter,
  sort: search.sort,
  offset: search.offset,
})

export type ProductListDeps = ReturnType<typeof productListLoaderDeps>

/**
 * The route options every product list page — home, category, collection — shares, spread into
 * each `createFileRoute`. `ssr`, `component` and `loader` stay in the route file: `ssr` is the
 * route's ADR-0013 decision to make in plain sight, and the other two are what differs.
 */
export const productListRouteOptions = {
  head: (context: Parameters<typeof marketHeadLinksFor>[0]) => ({ links: marketHeadLinksFor(context) }),
  validateSearch: productListSearchSchema,
  loaderDeps: productListLoaderDeps,
  // A not-found page is not cached: the handle may be published a minute later.
  headers: ({ match }: { match: { status: string } }) => ({
    'Cache-Control': match.status === 'notFound' ? 'no-store' : 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
}
