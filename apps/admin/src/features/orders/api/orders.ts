import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { listAdminFulfillmentProviders } from '#/api/generated/fulfillment-providers/fulfillment-providers'
import type {
  AdminCreateOrderFulfillment,
  AdminCreateOrderShipment,
  AdminOrderActionResponse,
  ListOrdersParams,
} from '#/api/generated/model'
import {
  archiveOrder,
  cancelOrder,
  completeOrder,
  createOrderFulfillment,
  createOrderShipment,
  getOrder,
  listOrders,
  markOrderAsDelivered,
} from '#/api/generated/orders/orders'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const orderKeys = queryKeysFactory<'orders', ListOrdersParams>('orders')
const fulfillmentProviderKeys = queryKeysFactory('fulfillmentProviders')

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

export const useSuspenseOrder = (id: string) => useSuspenseQuery(orderQueryOptions(id))

export const fulfillmentProvidersQueryOptions = () =>
  queryOptions({
    queryKey: fulfillmentProviderKeys.list(),
    queryFn: () => listAdminFulfillmentProviders(),
  })

export const useFulfillmentProviders = () => useQuery(fulfillmentProvidersQueryOptions())

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

export const useCreateFulfillment = (
  id: string,
  options?: UseMutationOptions<AdminOrderActionResponse, Error, AdminCreateOrderFulfillment>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateOrderFulfillment) => createOrderFulfillment(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create fulfillment', description: error.message })
      onError?.(...args)
    },
  })
}

export const useCreateShipment = (
  id: string,
  fulfillmentId: string,
  options?: UseMutationOptions<AdminOrderActionResponse, Error, AdminCreateOrderShipment>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateOrderShipment) => createOrderShipment(id, fulfillmentId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create shipment', description: error.message })
      onError?.(...args)
    },
  })
}

export const useMarkAsDelivered = (
  id: string,
  fulfillmentId: string,
  options?: UseMutationOptions<AdminOrderActionResponse, Error, void>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => markOrderAsDelivered(id, fulfillmentId),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to mark as delivered', description: error.message })
      onError?.(...args)
    },
  })
}
