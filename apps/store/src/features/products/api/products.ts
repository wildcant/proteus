import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { UseQueryOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ApiError } from '#/api/api-error'
import type {
  GetStoreProductParams,
  ListStoreProductsParams,
  StoreProductListResponse,
  StoreProductResponse,
} from '#/api/generated/model'
import { getStoreProduct, listStoreProducts } from '#/api/generated/products/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const PRODUCTS_QUERY_KEY = 'products' as const
const productsQueryKeys = queryKeysFactory<typeof PRODUCTS_QUERY_KEY, ListStoreProductsParams>(PRODUCTS_QUERY_KEY)

export const PRODUCTS_DEFAULT_LIMIT = 12
const PRODUCTS_DEFAULT_OFFSET = 0

/**
 * The orders the catalogue can actually be sorted by. Price is absent on purpose: the starting
 * price is computed in the route *after* the list has been paged, so ordering by it would sort
 * each page against itself.
 *
 * `productListSearchSchema`'s `z.enum` reads this tuple, so the URL's vocabulary and the query layer's cannot
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
const PRODUCT_SORTS: Record<ProductSort, string> = {
  newest: '-createdAt,id',
  az: 'title,id',
  za: '-title,id',
}

export const PRODUCT_SORT_LABELS: Record<ProductSort, MessageDescriptor> = {
  newest: msg`Newest`,
  az: msg`A–Z`,
  za: msg`Z–A`,
}

/**
 * What a page narrows its product list to — a category or collection handle — on top of the
 * shopper's own search, Tags, filters, price range, sort and page. Everything the list request takes that the list does
 * not set itself, so a filter the API gains is a scope without a change here.
 */
export type ProductListScope = Omit<
  ListStoreProductsParams,
  'offset' | 'limit' | 'order' | 'q' | 'tag' | 'filter' | 'minPrice' | 'maxPrice' | 'countryCode' | 'cartId'
>

/**
 * The single place the URL's params become the API's, so the header's count and the grid resolve
 * from one request instead of two keys that drift apart.
 */
export const productsPageQuery = ({
  q,
  tag,
  filter,
  minPrice,
  maxPrice,
  sort,
  offset,
  scope,
  countryCode,
}: {
  q?: string
  /** The chosen Tag values: the list shows products carrying any of them. */
  tag?: string[]
  /** The chosen metafield and option values as `<key>:<value>`: any value of a key, every key. */
  filter?: string[]
  /** The price range, in the market's currency: products with a variant inside it. */
  minPrice?: number
  maxPrice?: number
  sort?: ProductSort
  offset?: number
  /** Spread under the page's own params, so a scope can never override the shopper's search. */
  scope: ProductListScope
  /**
   * The market's ISO-2. Required rather than optional, and part of what the key is built from:
   * it decides the currency every amount in the response is quoted in, so a call site that could
   * leave it out is a call site that can render one market's catalogue at another's prices.
   */
  countryCode: string
}): ListStoreProductsParams => ({
  ...scope,
  offset: offset ?? PRODUCTS_DEFAULT_OFFSET,
  limit: PRODUCTS_DEFAULT_LIMIT,
  q,
  tag,
  filter,
  minPrice,
  maxPrice,
  order: PRODUCT_SORTS[sort ?? PRODUCT_SORT_DEFAULT],
  countryCode,
})

type ProductsListQueryOptions = Omit<
  UseQueryOptions<StoreProductListResponse, Error, StoreProductListResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(productsListQueryOptions())`. */
export const productsListQueryOptions = (query: ListStoreProductsParams, options?: ProductsListQueryOptions) =>
  queryOptions({
    queryKey: productsQueryKeys.list(query),
    queryFn: () => listStoreProducts(query),
    ...options,
  })
/** Suspends until products list resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseProducts = (query: ListStoreProductsParams, options?: ProductsListQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(productsListQueryOptions(query, options))
  return { ...data, ...rest }
}

/**
 * Non-suspending, for UI that re-queries while the shopper is still typing. `keepPreviousData`
 * is the point: a suspending read blanks its boundary on every new term, so the grid would
 * flash empty between keystrokes instead of the last results sitting there until the next
 * ones land.
 */
export const useProducts = (query: ListStoreProductsParams, options?: ProductsListQueryOptions) => {
  const { data, ...rest } = useQuery({
    ...productsListQueryOptions(query, options),
    placeholderData: keepPreviousData,
  })
  return { ...data, ...rest }
}

/** The detail answer, with the product absent when this market has none under that handle. */
type ProductDetail = { product: StoreProductResponse['product'] | undefined }

type ProductQueryOptions = Omit<UseQueryOptions<ProductDetail, Error, ProductDetail>, 'queryFn' | 'queryKey'>
/**
 * Shared query config. Use in route loaders via `prefetchQuery(productQueryOptions(handle, market))`.
 *
 * `countryCode` is in the key for the reason it is in `productsPageQuery`: the same product is a
 * different answer in a different market, and one key for both would serve pesos to a shopper
 * reading dollars.
 */
export const productQueryOptions = (handle: string, query: GetStoreProductParams, options?: ProductQueryOptions) =>
  queryOptions({
    queryKey: productsQueryKeys.detail(handle, query),
    /**
     * A 404 resolves rather than throws, because it is an answer: the API returns one both for a
     * handle we never had and for a product this market cannot price, which is the ordinary case now
     * that a market decides the catalogue. Thrown, it reached the route's error boundary — and an
     * error boundary on a routine path costs a retry, a dev console pair per attempt, and the
     * whole match's data. Every other status still throws, which is what the boundary is for.
     */
    queryFn: async () => {
      try {
        return await getStoreProduct(handle, query)
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return { product: undefined }
        throw error
      }
    },
    ...options,
  })
/** Suspends until product detail resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseProduct = (handle: string, query: GetStoreProductParams, options?: ProductQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(productQueryOptions(handle, query, options))
  return { ...data, ...rest }
}
