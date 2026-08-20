import type { UseQueryOptions } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addStoreCartLineItem,
  createStoreCart,
  deleteStoreCartLineItem,
  getStoreCart,
  updateStoreCartLineItem,
} from '#/api/generated/carts/carts'
import type {
  AddStoreCartLineItemBody,
  StoreCartDetailResponse,
  UpdateStoreCartLineItemBody,
} from '#/api/generated/model'
import { getCartId, setCartId } from '#/lib/cart-id'
import { queryKeysFactory } from '#/lib/query-key-factory'

const CART_QUERY_KEY = 'cart' as const
export const cartQueryKeys = queryKeysFactory(CART_QUERY_KEY)

export const useCart = (
  options?: Omit<
    UseQueryOptions<StoreCartDetailResponse | null, Error, StoreCartDetailResponse | null>,
    'queryFn' | 'queryKey'
  >,
) => {
  const { data, ...rest } = useQuery({
    queryKey: cartQueryKeys.all,
    queryFn: async () => {
      const cartId = getCartId()
      if (!cartId) return null
      return getStoreCart(cartId)
    },
    ...options,
  })
  return { cart: data?.cart ?? null, ...rest }
}

export const useCreateCart = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await createStoreCart({})
      setCartId(response.cart.id)
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}

export const useAddLineItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AddStoreCartLineItemBody) => {
      let cartId = getCartId()
      if (!cartId) {
        const cartResponse = await createStoreCart({})
        cartId = cartResponse.cart.id
        setCartId(cartId)
      }
      return addStoreCartLineItem(cartId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}

export const useUpdateLineItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ lineId, ...body }: UpdateStoreCartLineItemBody & { lineId: string }) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return updateStoreCartLineItem(cartId, lineId, body)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}

export const useRemoveLineItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (lineId: string) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return deleteStoreCartLineItem(cartId, lineId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
    },
  })
}
