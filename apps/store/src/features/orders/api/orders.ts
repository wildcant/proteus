import type { UseQueryOptions } from '@tanstack/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreOrdersParams, StoreOrderListResponse, StoreOrderResponse } from '#/api/generated/model'
import { getStoreOrder, listStoreOrders } from '#/api/generated/orders/orders'
import { queryKeysFactory } from '#/lib/query-key-factory'

const ORDERS_QUERY_KEY = 'orders' as const
export const ordersQueryKeys = queryKeysFactory<typeof ORDERS_QUERY_KEY, ListStoreOrdersParams>(ORDERS_QUERY_KEY)

/** Five rows is what the account panel shows before it pages. */
export const ORDERS_DEFAULT_LIMIT = 5
export const ORDERS_DEFAULT_OFFSET = 0

/**
 * One page of the customer's orders, newest first. Built here rather than at each call site so
 * the account route's prefetch and the panel's read produce the identical query key — a
 * mismatched key would refetch on mount and waterfall behind the greeting anyway.
 */
export const ordersPageQuery = (offset: number = ORDERS_DEFAULT_OFFSET): ListStoreOrdersParams => ({
  offset,
  limit: ORDERS_DEFAULT_LIMIT,
  order: '-createdAt',
})

type OrdersListQueryOptions = Omit<
  UseQueryOptions<StoreOrderListResponse, Error, StoreOrderListResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(ordersListQueryOptions())`. */
export const ordersListQueryOptions = (query?: ListStoreOrdersParams, options?: OrdersListQueryOptions) =>
  queryOptions({
    queryKey: ordersQueryKeys.list(query),
    queryFn: () => listStoreOrders(query),
    ...options,
  })

/** Suspends until orders list resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseOrders = (query?: ListStoreOrdersParams, options?: OrdersListQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(ordersListQueryOptions(query, options))
  return { ...data, ...rest }
}

type OrderQueryOptions = Omit<UseQueryOptions<StoreOrderResponse, Error, StoreOrderResponse>, 'queryFn' | 'queryKey'>
/** Shared query config. Use in route loaders via `prefetchQuery(orderQueryOptions(id))`. */
export const orderQueryOptions = (id: string, options?: OrderQueryOptions) =>
  queryOptions({
    queryKey: ordersQueryKeys.detail(id),
    queryFn: () => getStoreOrder(id),
    ...options,
  })

/** Suspends until order detail resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseOrder = (id: string, options?: OrderQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(orderQueryOptions(id, options))
  return { ...data, ...rest }
}
