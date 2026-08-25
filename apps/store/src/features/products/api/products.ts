import type { UseQueryOptions } from '@tanstack/react-query'
import { keepPreviousData, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreProductsParams, StoreProductListResponse, StoreProductResponse } from '#/api/generated/model'
import { getStoreProduct, listStoreProducts } from '#/api/generated/products/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const PRODUCTS_QUERY_KEY = 'products' as const
export const productsQueryKeys = queryKeysFactory(PRODUCTS_QUERY_KEY)

export const PRODUCTS_DEFAULT_LIMIT = 12
export const PRODUCTS_DEFAULT_OFFSET = 0

type ProductsListQueryOptions = Omit<
  UseQueryOptions<StoreProductListResponse, Error, StoreProductListResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(productsListQueryOptions())`. */
export const productsListQueryOptions = (query?: ListStoreProductsParams, options?: ProductsListQueryOptions) => ({
  queryKey: productsQueryKeys.list(query),
  queryFn: () => listStoreProducts(query),
  ...options,
})
/** Suspends until products list resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseProducts = (query?: ListStoreProductsParams, options?: ProductsListQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(productsListQueryOptions(query, options))
  return { ...data, ...rest }
}

/**
 * Non-suspending, for UI that re-queries while the shopper is still typing. `keepPreviousData`
 * is the point: a suspending read blanks its boundary on every new term, so the grid would
 * flash empty between keystrokes instead of the last results sitting there until the next
 * ones land.
 */
export const useProducts = (query?: ListStoreProductsParams, options?: ProductsListQueryOptions) => {
  const { data, ...rest } = useQuery({
    ...productsListQueryOptions(query, options),
    placeholderData: keepPreviousData,
  })
  return { ...data, ...rest }
}

type ProductQueryOptions = Omit<
  UseQueryOptions<StoreProductResponse, Error, StoreProductResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(productQueryOptions(id))`. */
export const productQueryOptions = (id: string, options?: ProductQueryOptions) => ({
  queryKey: productsQueryKeys.detail(id),
  queryFn: () => getStoreProduct(id),
  ...options,
})
/** Suspends until product detail resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseProduct = (id: string, options?: ProductQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(productQueryOptions(id, options))
  return { ...data, ...rest }
}
