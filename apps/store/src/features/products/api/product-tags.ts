import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreProductTagValuesParams } from '#/api/generated/model'
import { listStoreProductTagValues } from '#/api/generated/product-tags/product-tags'
import type { ProductListScope } from '#/features/products/api/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productTagValueKeys = queryKeysFactory<'store-product-tags', ListStoreProductTagValuesParams>(
  'store-product-tags',
)

/**
 * The chips' request for a list: its scope, the shopper's search and the market — never the chosen
 * Tags, so choosing one does not take the others away. `countryCode` is required for the reason it
 * is in `productsPageQuery`: the market decides which products, and so which values, are in view.
 */
export const productTagValuesQuery = ({
  scope,
  q,
  countryCode,
}: {
  scope: ProductListScope
  q?: string
  countryCode: string
}): ListStoreProductTagValuesParams => ({ category: scope.category, collection: scope.collection, q, countryCode })

/** Shared query config. Use in route loaders via `ensureQueryData(productTagValuesQueryOptions(query))`. */
export const productTagValuesQueryOptions = (query: ListStoreProductTagValuesParams) =>
  queryOptions({
    queryKey: productTagValueKeys.list(query),
    queryFn: async () => (await listStoreProductTagValues(query)).values,
  })

/** Suspends until the values resolve — which, on a product list page, its loader has already awaited. */
export const useSuspenseProductTagValues = (query: ListStoreProductTagValuesParams) =>
  useSuspenseQuery(productTagValuesQueryOptions(query)).data
