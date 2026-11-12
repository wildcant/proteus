import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreProductFiltersParams } from '#/api/generated/model'
import { listStoreProductFilters } from '#/api/generated/products/products'
import type { ProductListScope } from '#/features/products/api/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productFilterKeys = queryKeysFactory<'store-product-filters', ListStoreProductFiltersParams>(
  'store-product-filters',
)

/**
 * The filter bar's request for a list: its scope, the shopper's search, the chosen Tags and metafield
 * values, and the market. The choices are in it because they move the counts; the scope alone decides
 * which values are offered. `countryCode` is required for the reason it is in `productsPageQuery`.
 */
export const productFiltersQuery = ({
  scope,
  q,
  tag,
  filter,
  countryCode,
}: {
  scope: ProductListScope
  q?: string
  tag?: string[]
  filter?: string[]
  countryCode: string
}): ListStoreProductFiltersParams => ({
  category: scope.category,
  collection: scope.collection,
  q,
  tag,
  filter,
  countryCode,
})

/** Shared query config. Use in route loaders via `ensureQueryData(productFiltersQueryOptions(query))`. */
export const productFiltersQueryOptions = (query: ListStoreProductFiltersParams) =>
  queryOptions({
    queryKey: productFilterKeys.list(query),
    queryFn: async () => (await listStoreProductFilters(query)).filters,
  })

/** Suspends until the filters resolve — which, on a product list page, its loader has already awaited. */
export const useSuspenseProductFilters = (query: ListStoreProductFiltersParams) =>
  useSuspenseQuery(productFiltersQueryOptions(query)).data
