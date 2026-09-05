import { toast } from '@proteus/ui'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import {
  addStoreCartLineItem,
  createStoreCart,
  deleteStoreCartLineItem,
  getStoreCart,
  transferStoreCartCustomer,
  updateStoreCart,
  updateStoreCartLineItem,
} from '#/api/generated/carts/carts'
import type {
  AddStoreCartLineItemBody,
  DeleteResponse,
  StoreCartDetailResponse,
  StoreCartResponse,
  StoreCreateCartLineItemResponse,
  StoreCreateCartResponse,
  StoreUpdateCartLineItemResponse,
  StoreUpdateCartResponse,
  UpdateStoreCartLineItemBody,
} from '#/api/generated/model'
import { getCartId, setCartId } from '#/lib/cart-id'
import { queryKeysFactory } from '#/lib/query-key-factory'
import { useMarket } from '#/lib/use-market'

const CART_QUERY_KEY = 'cart' as const
export const cartQueryKeys = queryKeysFactory(CART_QUERY_KEY)

type CartQueryOptions = Omit<
  UseQueryOptions<StoreCartDetailResponse | null, Error, StoreCartDetailResponse | null>,
  'queryFn' | 'queryKey'
>

/** Shared query config. Use in route loaders via `prefetchQuery(cartQueryOptions())`. */
export const cartQueryOptions = (options?: CartQueryOptions) => ({
  queryKey: cartQueryKeys.all,
  queryFn: async () => {
    const cartId = getCartId()
    if (!cartId) return null
    return getStoreCart(cartId)
  },
  ...options,
})

/** Suspends until cart data resolves. Use inside a `<Suspense>` boundary (route pages). */
export const useSuspenseCart = (options?: CartQueryOptions) => {
  const { data, ...rest } = useSuspenseQuery(cartQueryOptions(options))
  return { cart: data?.cart ?? null, ...rest }
}

/** Non-suspending variant. Renders immediately with `isLoading` — use for always-mounted UI (nav). */
export const useCart = (options?: CartQueryOptions) => {
  const { data, ...rest } = useQuery(cartQueryOptions(options))
  return { cart: data?.cart ?? null, ...rest }
}

export const useCreateCart = (options?: UseMutationOptions<StoreCreateCartResponse, Error, void>) => {
  const queryClient = useQueryClient()
  const { current } = useMarket()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: async () => {
      // The market a cart is opened in is the market it keeps: the country picks the region, the
      // region owns the currency, and the cart carries that currency for the rest of its life.
      // Nothing re-reads this later, so it is the one moment it can be got right.
      const response = await createStoreCart({}, { countryCode: current.iso2 })
      setCartId(response.cart.id)
      return response
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create cart', description: error.message })
      onError?.(...args)
    },
  })
}

/**
 * Moves the cart the shopper is already carrying into the market the page is in.
 *
 * Named by country, the same way `useCreateCart` names it: the storefront sends the segment it
 * already has in its own URL and the backend resolves the region and the currency behind it. That
 * is what keeps the answer to "what is a market" in one place — and why nothing here, or anywhere
 * else outside the generated client, knows a region id exists.
 *
 * No error toast, unlike every other mutation in this file. A refusal is not a failed click to
 * retry — the shopper never asked for this, and it leaves them somewhere: in a market holding a
 * bag priced in another one. `CartMarketSwitch` renders that state and keeps rendering it.
 */
export const useSwitchCartMarket = (options?: UseMutationOptions<StoreUpdateCartResponse, Error, void>) => {
  const queryClient = useQueryClient()
  const { current } = useMarket()
  const { onSuccess, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: () => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return updateStoreCart(cartId, { countryCode: current.iso2 })
    },
    onSuccess: (...args) => {
      // Everything, not just the cart: a switch restates every priced answer this client is
      // holding — the line items, the shipping options and payment providers keyed by the cart's
      // id, and the catalogue prices around it. After it lands none of them is still true.
      queryClient.invalidateQueries()
      onSuccess?.(...args)
    },
  })
}

export const useAddLineItem = (
  options?: UseMutationOptions<StoreCreateCartLineItemResponse, Error, AddStoreCartLineItemBody>,
) => {
  const queryClient = useQueryClient()
  const { current } = useMarket()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: async (payload: AddStoreCartLineItemBody) => {
      let cartId = getCartId()
      if (!cartId) {
        // Same as `useCreateCart`: the first add is where a shopper's cart gets its currency.
        const cartResponse = await createStoreCart({}, { countryCode: current.iso2 })
        cartId = cartResponse.cart.id
        setCartId(cartId)
      }
      return addStoreCartLineItem(cartId, payload)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to add item to cart', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateLineItem = (
  options?: UseMutationOptions<
    StoreUpdateCartLineItemResponse,
    Error,
    UpdateStoreCartLineItemBody & { lineId: string }
  >,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: ({ lineId, ...body }: UpdateStoreCartLineItemBody & { lineId: string }) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return updateStoreCartLineItem(cartId, lineId, body)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update cart item', description: error.message })
      onError?.(...args)
    },
  })
}

export const useRemoveLineItem = (options?: UseMutationOptions<DeleteResponse, Error, string>) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: (lineId: string) => {
      const cartId = getCartId()
      if (!cartId) throw new Error('No cart exists')
      return deleteStoreCartLineItem(cartId, lineId)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to remove cart item', description: error.message })
      onError?.(...args)
    },
  })
}

export const useTransferCart = (options?: UseMutationOptions<StoreCartResponse | null, Error, void>) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: async () => {
      const cartId = getCartId()
      if (!cartId) return null
      return transferStoreCartCustomer(cartId)
    },
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: cartQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to transfer cart', description: error.message })
      onError?.(...args)
    },
  })
}
