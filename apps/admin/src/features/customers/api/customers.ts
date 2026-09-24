import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { deleteCustomer, getCustomer, listCustomers, updateCustomer } from '#/api/generated/customers/customers'
import type {
  AdminCustomerListResponse,
  AdminCustomerResponse,
  AdminUpdateCustomer,
  DeleteResponse,
  ListCustomersParams,
} from '#/api/generated/model'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const CUSTOMERS_QUERY_KEY = 'customers' as const
const customersQueryKeys = queryKeysFactory<typeof CUSTOMERS_QUERY_KEY, ListCustomersParams>(CUSTOMERS_QUERY_KEY)

// --- Query options (for route loaders) ---

type CustomersListQueryOptions = Omit<
  UseQueryOptions<AdminCustomerListResponse, Error, AdminCustomerListResponse>,
  'queryFn' | 'queryKey'
>
export const customersListQueryOptions = (query?: ListCustomersParams, options?: CustomersListQueryOptions) =>
  queryOptions({
    queryKey: customersQueryKeys.list(query),
    queryFn: () => listCustomers(query),
    placeholderData: keepPreviousData,
    ...options,
  })

export const customerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: customersQueryKeys.detail(id),
    queryFn: () => getCustomer(id),
  })

// --- Query hooks ---

export const useCustomers = (query?: ListCustomersParams, options?: CustomersListQueryOptions) =>
  useQuery(customersListQueryOptions(query, options))

export const useSuspenseCustomer = (id: string) => useSuspenseQuery(customerQueryOptions(id))

// --- Mutation hooks ---

export const useUpdateCustomer = (
  options?: UseMutationOptions<AdminCustomerResponse, Error, { id: string; data?: AdminUpdateCustomer }>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ id, data }) => updateCustomer(id, data),
    onSuccess: (...args) => {
      const [, variables] = args
      queryClient.invalidateQueries({ queryKey: customersQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(variables.id) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update customer`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteCustomer = (options?: UseMutationOptions<DeleteResponse, Error, { id: string }>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: ({ id }) => deleteCustomer(id),
    onSuccess: (...args) => {
      const [, variables] = args
      queryClient.invalidateQueries({ queryKey: customersQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: customersQueryKeys.detail(variables.id) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete customer`, description: error.message })
      onError?.(...args)
    },
  })
}
