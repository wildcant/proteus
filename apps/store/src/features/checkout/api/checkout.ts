import type { UseMutationOptions } from '@tanstack/react-query'
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
  StoreCompleteCartResponse,
  UpdateStoreCartBody,
} from '#/api/generated/model'
import {
  createStorePaymentCollection,
  createStorePaymentSession,
} from '#/api/generated/payment-collections/payment-collections'
import { listStorePaymentProviders } from '#/api/generated/payments/payments'
import { cartQueryKeys } from '#/features/cart/api/cart'
import { clearCartId, getCartId } from '#/lib/cart-id'
import { queryKeysFactory } from '#/lib/query-key-factory'

const checkoutQueryKeys = queryKeysFactory('checkout')

export const useShippingOptions = (cartId: string | null) => {
  return useQuery({
    queryKey: [...checkoutQueryKeys.all, 'shipping-options', cartId],
    queryFn: () => {
      if (!cartId) throw new Error('No cart')
      return listStoreCartShippingOptions(cartId)
    },
    enabled: !!cartId,
  })
}

export const usePaymentProviders = () => {
  return useQuery({
    queryKey: [...checkoutQueryKeys.all, 'payment-providers'],
    queryFn: () => listStorePaymentProviders(),
  })
}

export const useUpdateCart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: UpdateStoreCartBody) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return updateStoreCart(cartId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}

export const useSelectShippingMethod = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AddStoreCartShippingMethodBody) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return addStoreCartShippingMethod(cartId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}

export const useCreatePaymentCollection = () => {
  return useMutation({
    mutationFn: (payload: CreateStorePaymentCollectionBody) => createStorePaymentCollection(payload),
  })
}

export const useCreatePaymentSession = () => {
  return useMutation({
    mutationFn: ({ collectionId, ...payload }: CreateStorePaymentSessionBody & { collectionId: string }) =>
      createStorePaymentSession(collectionId, payload),
  })
}

export const useCompleteCart = (options?: UseMutationOptions<StoreCompleteCartResponse, Error, void>) => {
  const { onSuccess, ...rest } = options ?? {}

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
  })
}
