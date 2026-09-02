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
  StoreUpdatePaymentSessionResponse,
  UpdateStoreCartBody,
} from '#/api/generated/model'
import {
  createStorePaymentCollection,
  createStorePaymentSession,
  updateStorePaymentSession,
} from '#/api/generated/payment-collections/payment-collections'
import { listStorePaymentProviders } from '#/api/generated/payments/payments'
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

export const usePaymentProviders = () => {
  return useQuery({
    queryKey: [...checkoutQueryKeys.all, 'payment-providers'],
    queryFn: () => listStorePaymentProviders(),
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

/**
 * Re-prices an open session from the cart's server-side total.
 *
 * The body is empty by design: the browser names the session and is told what the cart came to.
 * See `useOpenPaymentSession` for why every place-order press ends with this call.
 */
export const useRepricePaymentSession = (
  options?: UseMutationOptions<StoreUpdatePaymentSessionResponse, Error, { collectionId: string; sessionId: string }>,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ collectionId, sessionId }: { collectionId: string; sessionId: string }) =>
      updateStorePaymentSession(collectionId, sessionId, {}),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to price the payment', description: error.message })
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
