import type { UseQueryOptions } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import type { ListStoreOrdersParams, StoreOrderListResponse, StoreOrderResponse } from '#/api/generated/model'
import { getStoreOrder, listStoreOrders } from '#/api/generated/orders/orders'
import { queryKeysFactory } from '#/lib/query-key-factory'

const ORDERS_QUERY_KEY = 'orders' as const
export const ordersQueryKeys = queryKeysFactory(ORDERS_QUERY_KEY)

// --- Query options (for route loaders) ---

export const ordersListQueryOptions = (query?: ListStoreOrdersParams) => ({
  queryKey: ordersQueryKeys.list(query),
  queryFn: () => listStoreOrders(query),
})

export const orderQueryOptions = (id: string) => ({
  queryKey: ordersQueryKeys.detail(id),
  queryFn: () => getStoreOrder(id),
})

// --- Query hooks ---

export const useOrders = (
  query?: ListStoreOrdersParams,
  options?: Omit<UseQueryOptions<StoreOrderListResponse, Error, StoreOrderListResponse>, 'queryFn' | 'queryKey'>,
) => {
  const { data, ...rest } = useQuery({
    queryFn: () => listStoreOrders(query),
    queryKey: ordersQueryKeys.list(query),
    ...options,
  })
  return { ...data, ...rest }
}

export const useOrder = (
  id: string,
  options?: Omit<UseQueryOptions<StoreOrderResponse, Error, StoreOrderResponse>, 'queryFn' | 'queryKey'>,
) => {
  const { data, ...rest } = useQuery({
    ...orderQueryOptions(id),
    ...options,
  })
  return { ...data, ...rest }
}
