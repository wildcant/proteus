import type { UseQueryOptions } from '@tanstack/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ListStoreOrdersParams, StoreOrderListResponse, StoreOrderResponse } from '#/api/generated/model'
import { getStoreOrder, listStoreOrders } from '#/api/generated/orders/orders'
import { queryKeysFactory } from '#/lib/query-key-factory'

const ORDERS_QUERY_KEY = 'orders' as const
export const ordersQueryKeys = queryKeysFactory(ORDERS_QUERY_KEY)

type OrdersListQueryOptions = Omit<
  UseQueryOptions<StoreOrderListResponse, Error, StoreOrderListResponse>,
  'queryFn' | 'queryKey'
>
/** Shared query config. Use in route loaders via `prefetchQuery(ordersListQueryOptions())`. */
export const ordersListQueryOptions = (query?: ListStoreOrdersParams, options?: OrdersListQueryOptions) => ({
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
export const orderQueryOptions = (id: string, options?: OrderQueryOptions) => ({
  queryKey: ordersQueryKeys.detail(id),
  queryFn: () => getStoreOrder(id),
  ...options,
})

/** Suspends until order detail resolves. Use inside a `<Suspense>` boundary. */
export const useSuspenseOrder = (id: string, options?: OrderQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(orderQueryOptions(id, options))
  return { ...data, ...rest }
}
