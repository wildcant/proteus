import { toast } from '@proteus/ui'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  StoreShippingOptionListResponse,
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
import { isStaleMethodError, rethrowAsStaleMethod } from '../utils/payment/session-errors'

// Two resources, two key namespaces. One 'checkout' namespace would give both of them the same
// `lists()` key, so neither could be invalidated without taking the other with it.
const shippingOptionKeys = queryKeysFactory<
  'shipping-options',
  ListStoreCartShippingOptionsParams & { cartId: string }
>('shipping-options')
const paymentProviderKeys = queryKeysFactory<'payment-providers'>('payment-providers')

type ShippingOptionsQueryOptions = Omit<
  UseQueryOptions<StoreShippingOptionListResponse, Error, StoreShippingOptionListResponse>,
  'queryFn' | 'queryKey'
>

/** Shared query config. Keyed by cart *and* address, since the rates are quoted against both. */
export const shippingOptionsQueryOptions = (
  cartId: string,
  params: ListStoreCartShippingOptionsParams,
  options?: ShippingOptionsQueryOptions,
) =>
  queryOptions({
    queryKey: shippingOptionKeys.list({ ...params, cartId }),
    queryFn: () => listStoreCartShippingOptions(cartId, params),
    // The delivery step mounts this form before it has a cart to quote against. A caller with a
    // stricter gate of its own — a complete address, say — passes its own `enabled` and replaces
    // this one, which is safe because a cart is what it took to reach the step at all.
    enabled: !!cartId,
    ...options,
  })

export const useShippingOptions = (
  cartId: string,
  params: ListStoreCartShippingOptionsParams,
  options?: ShippingOptionsQueryOptions,
) => useQuery(shippingOptionsQueryOptions(cartId, params, options))

/** Shared query config. Use in route loaders via `prefetchQuery(paymentProvidersQueryOptions())`. */
export const paymentProvidersQueryOptions = () =>
  queryOptions({
    queryKey: paymentProviderKeys.lists(),
    queryFn: () => listStorePaymentProviders(),
  })

export const usePaymentProviders = () => useQuery(paymentProvidersQueryOptions())

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
      // Raised here rather than at the call site, so every caller of this mutation sees the one
      // refusal the wallet can recover from as its own type rather than as a status code.
      createStorePaymentSession(collectionId, payload).catch(rethrowAsStaleMethod),
    onError: (...args) => {
      const [error] = args
      // A stale saved card is the one refusal the checkout recovers from in place: the wallet
      // refetches and the selection resets to the new-method form, with a message beside the
      // button that says so. A toast on top of that is the same news told twice.
      if (!isStaleMethodError(error)) {
        toast.add({ type: 'error', title: 'Failed to create payment session', description: error.message })
      }
      onError?.(...args)
    },
  })
}

/**
 * Re-prices an open session from the cart's server-side total.
 *
 * There is no body: the browser names the session in the URL and is told what the cart came to.
 * See `useOpenPaymentSession` for why every place-order press ends with this call.
 */
export const useRepricePaymentSession = (
  options?: UseMutationOptions<StoreUpdatePaymentSessionResponse, Error, { collectionId: string; sessionId: string }>,
) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ collectionId, sessionId }: { collectionId: string; sessionId: string }) =>
      updateStorePaymentSession(collectionId, sessionId),
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
