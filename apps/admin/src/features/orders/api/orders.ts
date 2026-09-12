import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type { AdminOrderActionResponse, ListOrdersParams } from '#/api/generated/model'
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

export const useCompleteOrder = (id: string, options?: UseMutationOptions<AdminOrderActionResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => completeOrder(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to complete order', description: error.message })
      onError?.(...args)
    },
  })
}

export const useCancelOrder = (id: string, options?: UseMutationOptions<AdminOrderActionResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => cancelOrder(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to cancel order', description: error.message })
      onError?.(...args)
    },
  })
}

export const useArchiveOrder = (id: string, options?: UseMutationOptions<AdminOrderActionResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => archiveOrder(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to archive order', description: error.message })
      onError?.(...args)
    },
  })
}
