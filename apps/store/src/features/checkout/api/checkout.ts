import type { StoreShippingOptionListResponse } from '@proteus/http-schemas/store'
import { toast } from '@proteus/ui'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addStoreCartShippingMethod,
  completeStoreCart,
  listStoreCartShippingOptions,
  updateStoreCart,
} from '#/api/generated/carts/carts'
import type {
  AddStoreCartShippingMethodBody,
  CreateStorePaymentCollectionBody,
  CreateStorePaymentSessionBody,
  ListStoreCartShippingOptionsParams,
  StoreCompleteCartResponse,
  StoreCreateCartShippingMethodResponse,
  StoreCreatePaymentCollectionResponse,
  StoreCreatePaymentSessionResponse,
  StoreUpdateCartResponse,
  UpdateStoreCartBody,
} from '#/api/generated/model'
import {
  createStorePaymentCollection,
  createStorePaymentSession,
} from '#/api/generated/payment-collections/payment-collections'
import { listStoreCartPaymentProviders } from '#/api/generated/payments/payments'
import { cartQueryKeys } from '#/features/cart/api/cart'
import { clearCartId, getCartId } from '#/lib/cart-id'
import { queryKeysFactory } from '#/lib/query-key-factory'

const checkoutQueryKeys = queryKeysFactory('checkout')

export const useShippingOptions = (
  cartId: string,
  params: ListStoreCartShippingOptionsParams,
  options?: Partial<UseQueryOptions<StoreShippingOptionListResponse, Error>>,
) => {
  return useQuery({
    queryKey: [...checkoutQueryKeys.all, 'shipping-options', cartId, params],
    queryFn: () => listStoreCartShippingOptions(cartId, params),
    enabled: !!cartId && !!params && !!(options?.enabled ?? true),
  })
}

/** Keyed by cart because the answer is: the payment methods this cart's market offers. */
export const usePaymentProviders = (cartId: string) => {
  return useQuery({
    queryKey: [...checkoutQueryKeys.all, 'payment-providers', cartId],
    queryFn: () => listStoreCartPaymentProviders(cartId),
    enabled: !!cartId,
  })
}

export const useUpdateCart = (options?: UseMutationOptions<StoreUpdateCartResponse, Error, UpdateStoreCartBody>) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: (payload: UpdateStoreCartBody) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return updateStoreCart(cartId, payload)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update cart', description: error.message })
      onError?.(...args)
    },
  })
}

export const useSelectShippingMethod = (
  options?: UseMutationOptions<StoreCreateCartShippingMethodResponse, Error, AddStoreCartShippingMethodBody>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: (payload: AddStoreCartShippingMethodBody) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return addStoreCartShippingMethod(cartId, payload)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to select shipping method', description: error.message })
      onError?.(...args)
    },
  })
}

export const useCreatePaymentCollection = (
  options?: UseMutationOptions<StoreCreatePaymentCollectionResponse, Error, CreateStorePaymentCollectionBody>,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload: CreateStorePaymentCollectionBody) => createStorePaymentCollection(payload),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create payment collection', description: error.message })
      onError?.(...args)
    },
  })
}

export const useCreatePaymentSession = (
  options?: UseMutationOptions<
    StoreCreatePaymentSessionResponse,
    Error,
    CreateStorePaymentSessionBody & { collectionId: string }
  >,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ collectionId, ...payload }: CreateStorePaymentSessionBody & { collectionId: string }) =>
      createStorePaymentSession(collectionId, payload),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create payment session', description: error.message })
      onError?.(...args)
    },
  })
}

export const useCompleteCart = (options?: UseMutationOptions<StoreCompleteCartResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: () => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return completeStoreCart(cartId)
    },
    onSuccess: (...args) => {
      clearCartId()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to complete order', description: error.message })
      onError?.(...args)
    },
  })
}
