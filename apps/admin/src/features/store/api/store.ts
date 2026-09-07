import { queryOptions, useQuery } from '@tanstack/react-query'
import { getStore } from '#/api/generated/store/store'
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
