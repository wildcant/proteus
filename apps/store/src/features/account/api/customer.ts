import { queryOptions, useQuery } from '@tanstack/react-query'
import { getStoreCustomerMe } from '#/api/generated/customers/customers'
import { getToken } from '#/lib/auth-token'
import { queryKeysFactory } from '#/lib/query-key-factory'

const CUSTOMERS_QUERY_KEY = 'customers' as const
export const customersQueryKeys = queryKeysFactory(CUSTOMERS_QUERY_KEY)

type CustomerMeOptions = { enabled?: boolean }
export const customerMeQueryOptions = (options?: CustomerMeOptions) =>
  queryOptions({
    queryKey: customersQueryKeys.detail('me'),
    queryFn: () => getStoreCustomerMe(),
    ...options,
  })

export const useMe = (options?: CustomerMeOptions) => {
  const token = getToken()
  const enabled = !!token && (options?.enabled ?? true)
  const { data, ...rest } = useQuery(customerMeQueryOptions(options))
  // React Query retains stale data when a query becomes disabled.
  // For auth-gated queries this is wrong — don't expose previous session data.
  return { customer: enabled ? (data?.customer ?? null) : null, ...rest }
}
