import type { UseQueryOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreProductsParams, StoreProductListResponse, StoreProductResponse } from '#/api/generated/model'
import { getStoreProduct, listStoreProducts } from '#/api/generated/products/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const PRODUCTS_QUERY_KEY = 'products' as const
export const productsQueryKeys = queryKeysFactory<typeof PRODUCTS_QUERY_KEY, ListStoreProductsParams>(
  PRODUCTS_QUERY_KEY,
)

export const PRODUCTS_DEFAULT_LIMIT = 12
export const PRODUCTS_DEFAULT_OFFSET = 0

/**
 * The orders the catalogue can actually be sorted by. Price is absent on purpose: the starting
 * price is computed in the route *after* the list has been paged, so ordering by it would sort
 * each page against itself.
 *
 * The route's `z.enum` reads this tuple, so the URL's vocabulary and the query layer's cannot
 * drift.
 */
export const PRODUCT_SORT_NAMES = ['newest', 'az', 'za'] as const
export type ProductSort = (typeof PRODUCT_SORT_NAMES)[number]
export const PRODUCT_SORT_DEFAULT: ProductSort = 'newest'

/**
 * Friendly name to the API's `order` string. Every entry carries `id` as a tiebreaker — a seeded
 * catalogue shares one `createdAt` to the microsecond, and an offset pager over rows the database
 * considers equal is free to repeat one page's row on the next.
 */
export const PRODUCT_SORTS: Record<ProductSort, string> = {
  newest: '-createdAt,id',
  az: 'title,id',
  za: '-title,id',
}

export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  az: 'A–Z',
  za: 'Z–A',
}

/**
 * The single place the URL's params become the API's, so the header's count and the grid resolve
 * from one request instead of two keys that drift apart.
 */
export const productsPageQuery = ({
  q,
  sort,
  offset,
}: {
  q?: string
  sort?: ProductSort
  offset?: number
}): ListStoreProductsParams => ({
  offset: offset ?? PRODUCTS_DEFAULT_OFFSET,
  limit: PRODUCTS_DEFAULT_LIMIT,
  q,
  order: PRODUCT_SORTS[sort ?? PRODUCT_SORT_DEFAULT],
})

type ProductsListQueryOptions = Omit<
  UseQueryOptions<StoreProductListResponse, Error, StoreProductListResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(productsListQueryOptions())`. */
export const productsListQueryOptions = (query?: ListStoreProductsParams, options?: ProductsListQueryOptions) =>
  queryOptions({
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
export const productQueryOptions = (id: string, options?: ProductQueryOptions) =>
  queryOptions({
    queryKey: productsQueryKeys.detail(id),
    queryFn: () => getStoreProduct(id),
    ...options,
  })
/** Suspends until product detail resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseProduct = (id: string, options?: ProductQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(productQueryOptions(id, options))
  return { ...data, ...rest }
}
