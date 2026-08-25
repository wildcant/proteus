import { queryOptions, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { getStoreCustomerMe } from '#/api/generated/customers/customers'
import { isRegistered } from '#/lib/auth-token'
import { queryKeysFactory } from '#/lib/query-key-factory'

const CUSTOMERS_QUERY_KEY = 'customers' as const
export const customersQueryKeys = queryKeysFactory(CUSTOMERS_QUERY_KEY)

type CustomerMeOptions = { enabled?: boolean }
export const customerMeQueryOptions = (options?: CustomerMeOptions) =>
  queryOptions({
    queryKey: customersQueryKeys.detail('me'),
    queryFn: () => getStoreCustomerMe(),
    // An unregistered signup token can never satisfy this endpoint, and the 401 would
    // clear the session. See isRegistered().
    enabled: isRegistered(),
    ...options,
  })

export const useSuspenseMe = () => {
  const { data, ...rest } = useSuspenseQuery(customerMeQueryOptions())
  return { customer: data.customer, ...rest }
}

export const useMe = (options?: CustomerMeOptions) => {
  const { data, ...rest } = useQuery(customerMeQueryOptions(options))
  return { ...data, ...rest }
}
