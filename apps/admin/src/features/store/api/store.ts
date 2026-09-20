import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type {
  AdminAddStoreCurrencies,
  AdminStoreResponse,
  AdminUpdateStore,
  DeleteResponse,
} from '#/api/generated/model'
import {
  addStoreCurrencies,
  getStore,
  removeStoreCurrency,
  setDefaultStoreCurrency,
  updateStore,
} from '#/api/generated/store/store'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const storeKeys = queryKeysFactory<'store'>('store')

export const storeQueryOptions = () =>
  queryOptions({
    queryKey: storeKeys.all,
    queryFn: () => getStore(),
  })

/** The store and the currencies it sells in. There is exactly one, so this takes no id. */
export const useStore = () => useQuery(storeQueryOptions())

/**
 * The currency codes every price form offers, in the order the API returns them — default first.
 *
 * Every multi-currency surface wants the codes rather than the store, and each deriving its own
 * `?? []` is how one of them ends up rendering a `usd` column the store does not sell in. `pending`
 * is passed on so a grid can show a skeleton instead of a row of columns that is about to change.
 */
export const useStoreCurrencies = () => {
  const { data, isPending } = useStore()
  return { currencyCodes: (data?.store.currencies ?? []).map((currency) => currency.currencyCode), isPending }
}

/**
 * There is one store, so there is one cache entry: every mutation here invalidates all of it.
 *
 * The currency writes answer with the whole store, so the screen has already re-rendered by the
 * time this refetch lands — it is what keeps a second tab, and the price editor's columns, honest.
 */
const invalidateStore = () => {
  queryClient.invalidateQueries({ queryKey: storeKeys.all })
}

export const useUpdateStore = (options?: UseMutationOptions<AdminStoreResponse, Error, AdminUpdateStore>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateStore) => updateStore(data),
    onSuccess: (...args) => {
      invalidateStore()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update store', description: error.message })
      onError?.(...args)
    },
  })
}

export const useAddStoreCurrencies = (
  options?: UseMutationOptions<AdminStoreResponse, Error, AdminAddStoreCurrencies>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminAddStoreCurrencies) => addStoreCurrencies(data),
    onSuccess: (...args) => {
      invalidateStore()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to add currencies', description: error.message })
      onError?.(...args)
    },
  })
}

export const useSetDefaultStoreCurrency = (options?: UseMutationOptions<AdminStoreResponse, Error, string>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (currencyCode: string) => setDefaultStoreCurrency(currencyCode),
    onSuccess: (...args) => {
      invalidateStore()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to change the default currency', description: error.message })
      onError?.(...args)
    },
  })
}

/**
 * Removing currencies, one code or several.
 *
 * The bulk case is the checkbox column's, and it is several requests rather than one because the
 * API removes a currency by naming it. The API refuses two of them — the default, and any currency
 * a region settles in — and it is the toast below that carries that refusal to the merchant: it
 * names the region, which is the only thing that says what to do about it.
 */
export const useRemoveStoreCurrencies = (options?: UseMutationOptions<DeleteResponse[], Error, string[]>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (currencyCodes: string[]) => Promise.all(currencyCodes.map((code) => removeStoreCurrency(code))),
    onSuccess: (...args) => {
      invalidateStore()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      // Invalidated on failure too: a bulk removal can land in part, and the table has to show
      // which part rather than the selection the merchant started from.
      invalidateStore()
      toast.add({ type: 'error', title: 'Failed to remove currencies', description: error.message })
      onError?.(...args)
    },
  })
}
