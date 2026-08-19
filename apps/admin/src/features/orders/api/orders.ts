import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type { ListOrdersParams } from '#/api/generated/model'
import { archiveOrder, cancelOrder, completeOrder, getOrder, listOrders } from '#/api/generated/orders/orders'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const orderKeys = queryKeysFactory<'orders', ListOrdersParams>('orders')

export const ordersListQueryOptions = (params?: ListOrdersParams) =>
  queryOptions({
    queryKey: orderKeys.list(params),
    queryFn: () => listOrders(params),
    placeholderData: keepPreviousData,
  })

export const orderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
  })

export const useOrders = (params?: ListOrdersParams) => useQuery(ordersListQueryOptions(params))

export const useOrder = (id: string) => useQuery(orderQueryOptions(id))

export const useCompleteOrder = (id: string) => {
  return useMutation({
    mutationFn: () => completeOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}

export const useCancelOrder = (id: string) => {
  return useMutation({
    mutationFn: () => cancelOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}

export const useArchiveOrder = (id: string) => {
  return useMutation({
    mutationFn: () => archiveOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
    },
  })
}
