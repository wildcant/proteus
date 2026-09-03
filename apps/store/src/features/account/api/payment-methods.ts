import { toast } from '@proteus/ui'
import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type { StoreSavedMethod, StoreSavedMethodListResponse } from '#/api/generated/model'
import {
  deleteStorePaymentMethod,
  listStorePaymentMethods,
  setStoreDefaultPaymentMethod,
} from '#/api/generated/payments/payments'
import { isRegistered } from '#/lib/auth-token'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The shopper's wallet, read once for both surfaces that show it.
 *
 * The account page and the checkout selector share this query key on purpose: two lists of cards
 * that could disagree is the failure mode the shared row component exists to prevent, and two
 * cache entries would reintroduce it below the components. Nothing here sorts — ordering is the
 * backend's, defined once in `orderSavedMethods`, so neither surface holds an opinion about it.
 *
 * It lives under `features/account` rather than under the checkout because the wallet is an
 * account concept and the feature graph runs `checkout -> account`, never the reverse.
 */
export const paymentMethodsQueryKeys = queryKeysFactory('customer-payment-methods')

export const paymentMethodsQueryOptions = () =>
  queryOptions({
    queryKey: paymentMethodsQueryKeys.lists(),
    queryFn: () => listStorePaymentMethods(),
    // A guest has no wallet and the endpoint would 401, which the fetcher answers by clearing the
    // session. Same gate every other customer-scoped query uses. See `isRegistered`.
    enabled: isRegistered(),
    /**
     * One retry, not the default three.
     *
     * The wallet is the one query whose failure has a *useful* answer — the checkout falls back to
     * the card form so the shopper can still pay. Three retries with exponential backoff spend
     * roughly seven seconds proving that, and the shopper spends them looking at skeleton rows
     * where a payment form should be. One retry covers the blip and gets out of the way.
     */
    retry: 1,
  })

export type SavedMethod = StoreSavedMethod

/**
 * The wallet, plus the one thing a caller cannot recover from `data` alone.
 *
 * `failed` is separate from an empty list because the two mean opposite things to a shopper: an
 * empty wallet is a fact about them, a failed read is a fact about us. The selector falls back to
 * the new-method form either way, but only one of them earns a notice.
 */
export function usePaymentMethods() {
  const { data, isLoading, isError, refetch } = useQuery(paymentMethodsQueryOptions())

  // Both are stable across renders on purpose: the checkout selector registers this handle with
  // the place-order controller from an effect, and a fresh array or callback each render would
  // re-register on every keystroke elsewhere in the checkout.
  const refetchWallet = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    methods: data?.paymentMethods ?? NO_METHODS,
    isLoading,
    failed: isError,
    refetch: refetchWallet,
  }
}

/** One frozen empty list, so "no wallet yet" is the same value each render rather than a new one. */
const NO_METHODS: readonly StoreSavedMethod[] = Object.freeze([])

/**
 * Detaches a card — the one removal path, for both surfaces.
 *
 * The cache is **written**, not merely invalidated, and the write is what makes AC 8 true across a
 * navigation. Invalidating alone marks the list stale and refetches in the background, so a
 * surface that mounts before that refetch lands reads a wallet still holding the removed card —
 * and the checkout selector, mounting fresh, would auto-select it. Writing the card out first
 * means every surface agrees the moment the gateway says it is gone.
 *
 * The invalidation still follows, unawaited, so the list reconciles against the gateway. Awaiting
 * it is what made the account row sit at "Removing…" for two round trips instead of one, and it
 * would turn the checkout's optimistic drop into a blocking wait.
 */
export function useRemovePaymentMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (methodId: string) => deleteStorePaymentMethod(methodId),
    onSuccess: (_response, methodId) => {
      queryClient.setQueryData(paymentMethodsQueryKeys.lists(), (current: StoreSavedMethodListResponse | undefined) =>
        current ? { paymentMethods: current.paymentMethods.filter((method) => method.id !== methodId) } : current,
      )
      void queryClient.invalidateQueries({ queryKey: paymentMethodsQueryKeys.all })
    },
    // No toast. The row that failed renders its own retryable message, and the shopper is looking
    // straight at it — a toast on top is the same news told twice, which is the call this codebase
    // already makes for a stale method one file away in `checkout.ts`.
  })
}

/**
 * The wallet and the operation the checkout performs on it, as one hook.
 *
 * Bundled because they share a cache: a removal that did not write the list the selector reads is
 * how the two surfaces came to disagree about what a shopper owns. Handing an adapter one hook
 * rather than a list and a loose mutation makes a second removal path something you would have to
 * add on purpose.
 */
export function useWallet() {
  const { methods, isLoading, failed, refetch } = usePaymentMethods()
  const removeMethod = useRemovePaymentMethod()

  return {
    methods,
    isLoading,
    failed,
    refetch,
    remove: (methodId: string) => removeMethod.mutateAsync(methodId).then(() => undefined),
  }
}

/**
 * Nominates the card the next checkout starts on.
 *
 * The route answers with the whole wallet because nominating a default reorders it, so the
 * response is written straight into the cache: a client that had to refetch to learn its own new
 * order would render the old one for a round trip.
 */
export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (methodId: string) => setStoreDefaultPaymentMethod(methodId),
    onSuccess: (response) => {
      queryClient.setQueryData(paymentMethodsQueryKeys.lists(), response)
      void queryClient.invalidateQueries({ queryKey: paymentMethodsQueryKeys.all })
    },
    onError: (error: Error) => {
      toast.add({ type: 'error', title: 'Failed to set default card', description: error.message })
    },
  })
}
