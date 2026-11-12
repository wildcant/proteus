import type { QueryClient } from '@tanstack/react-query'
import { productFiltersQuery, productFiltersQueryOptions } from '#/features/products/api/product-filters'
import { productTagValuesQuery, productTagValuesQueryOptions } from '#/features/products/api/product-tags'
import { type ProductListScope, productsListQueryOptions, productsPageQuery } from '#/features/products/api/products'
import type { ProductListDeps } from '#/features/products/utils/product-list-route'
import type { MarketContext } from '#/lib/market'

/**
 * What every product list page's loader awaits, in parallel: the page of products, the Tag chips and
 * the filters for the same scope. A file of its own because it reads three resources.
 *
 * The market's country goes in with the rest of the page's parameters: it is what the backend prices
 * the response in, so a loader that left it out would SSR one market's catalogue at another's
 * currency and then swap it on hydration.
 */
export const ensureProductListData = async (
  context: { queryClient: QueryClient; market: MarketContext },
  { scope, ...deps }: ProductListDeps & { scope: ProductListScope },
) => {
  const countryCode = context.market.current.iso2
  // Awaited rather than returned: whatever a loader returns is serialised into the SSR payload, and
  // the cache already carries all of this.
  await Promise.all([
    context.queryClient.ensureQueryData(productsListQueryOptions(productsPageQuery({ ...deps, scope, countryCode }))),
    context.queryClient.ensureQueryData(
      productTagValuesQueryOptions(productTagValuesQuery({ ...deps, scope, countryCode })),
    ),
    context.queryClient.ensureQueryData(
      productFiltersQueryOptions(productFiltersQuery({ ...deps, scope, countryCode })),
    ),
  ])
}
