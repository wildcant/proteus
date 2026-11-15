import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminAddDraftOrderItems,
  AdminConvertDraftOrder,
  AdminDraftOrderResponse,
  AdminOrderActionResponse,
  AdminSetDraftOrderShippingMethod,
  AdminUpdateDraftOrder,
  AdminUpdateDraftOrderItem,
  DeleteResponse,
  ListDraftOrdersParams,
} from '#/api/generated/model'
import {
  addDraftOrderItems,
  cancelOrder,
  convertDraftOrder,
  deleteDraftOrder,
  getDraftOrder,
  listDraftOrders,
  removeDraftOrderItem,
  setDraftOrderShippingMethod,
  updateDraftOrder,
  updateDraftOrderItem,
} from '#/api/generated/orders/orders'
import { orderKeys } from '#/features/orders/api/orders'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const draftOrderKeys = queryKeysFactory<'draft-orders', ListDraftOrdersParams>('draft-orders')

export const draftOrdersListQueryOptions = (params?: ListDraftOrdersParams) =>
  queryOptions({
    queryKey: draftOrderKeys.list(params),
    queryFn: () => listDraftOrders(params),
    placeholderData: keepPreviousData,
  })

export const draftOrderQueryOptions = (id: string) =>
  queryOptions({
    queryKey: draftOrderKeys.detail(id),
    queryFn: () => getDraftOrder(id),
  })

export const useDraftOrders = (params?: ListDraftOrdersParams) => useQuery(draftOrdersListQueryOptions(params))

export const useSuspenseDraftOrder = (id: string) => useSuspenseQuery(draftOrderQueryOptions(id))

/** Every edit changes what the detail shows; the list shows the email and status, which some of them change. */
const invalidateDraft = (id: string) => {
  queryClient.invalidateQueries({ queryKey: draftOrderKeys.detail(id) })
  queryClient.invalidateQueries({ queryKey: draftOrderKeys.lists() })
}

export const useUpdateDraftOrder = (
  id: string,
  options?: UseMutationOptions<AdminDraftOrderResponse, Error, AdminUpdateDraftOrder>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateDraftOrder) => updateDraftOrder(id, data),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update draft order`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteDraftOrder = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteDraftOrder(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: draftOrderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete draft order`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useAddDraftOrderItems = (
  id: string,
  options?: UseMutationOptions<AdminDraftOrderResponse, Error, AdminAddDraftOrderItems>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminAddDraftOrderItems) => addDraftOrderItems(id, data),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to add item`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateDraftOrderItem = (
  id: string,
  itemId: string,
  options?: UseMutationOptions<AdminDraftOrderResponse, Error, AdminUpdateDraftOrderItem>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateDraftOrderItem) => updateDraftOrderItem(id, itemId, data),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to change quantity`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useRemoveDraftOrderItem = (
  id: string,
  itemId: string,
  options?: UseMutationOptions<DeleteResponse, Error, void>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => removeDraftOrderItem(id, itemId),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to remove item`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useSetDraftOrderShippingMethod = (
  id: string,
  options?: UseMutationOptions<AdminDraftOrderResponse, Error, AdminSetDraftOrderShippingMethod>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminSetDraftOrderShippingMethod) => setDraftOrderShippingMethod(id, data),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to set shipping method`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useConvertDraftOrder = (
  id: string,
  options?: UseMutationOptions<AdminOrderActionResponse, Error, AdminConvertDraftOrder | undefined>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data?: AdminConvertDraftOrder) => convertDraftOrder(id, data),
    onSuccess: (...args) => {
      // The draft leaves the drafts list and joins the orders list. Its draft detail is left alone:
      // refetched, it would answer "not found" to the page the admin is navigating away from.
      queryClient.invalidateQueries({ queryKey: draftOrderKeys.lists() })
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to convert draft order`, description: error.message })
      onError?.(...args)
    },
  })
}

/** A draft holds no money, so its cancel never carries a refund. */
export const useCancelDraftOrder = (
  id: string,
  options?: UseMutationOptions<AdminOrderActionResponse, Error, void>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => cancelOrder(id, {}),
    onSuccess: (...args) => {
      invalidateDraft(id)
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to cancel draft order`, description: error.message })
      onError?.(...args)
    },
  })
}
