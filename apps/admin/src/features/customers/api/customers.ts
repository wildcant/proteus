import { toast } from '@proteus/ui'
import type { UseMutationOptions, UseQueryOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import {
  createCustomers,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from '#/api/generated/customers/customers'
import type {
  AdminCreateCustomer,
  AdminCreateCustomersResponse,
  AdminCustomerListResponse,
  AdminCustomerResponse,
  AdminUpdateCustomer,
  DeleteResponse,
  ListCustomersParams,
} from '#/api/generated/model'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const CUSTOMERS_QUERY_KEY = 'customers' as const
export const customersQueryKeys = queryKeysFactory<typeof CUSTOMERS_QUERY_KEY, ListCustomersParams>(CUSTOMERS_QUERY_KEY)

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

type CustomerQueryOptions = Omit<
  UseQueryOptions<AdminCustomerResponse, Error, AdminCustomerResponse>,
  'queryFn' | 'queryKey'
>
export const customerQueryOptions = (id: string, options?: CustomerQueryOptions) =>
  queryOptions({
    queryKey: customersQueryKeys.detail(id),
    queryFn: () => getCustomer(id),
    ...options,
  })

// --- Query hooks ---

export const useCustomer = (id: string, options?: CustomerQueryOptions) => {
  const { data, ...rest } = useQuery(customerQueryOptions(id, options))
  return { ...data, ...rest }
}

export const useCustomers = (query?: ListCustomersParams, options?: CustomersListQueryOptions) => {
  const { data, ...rest } = useQuery(customersListQueryOptions(query, options))
  return { ...data, ...rest }
}

// --- Mutation hooks ---

export const useCreateCustomer = (
  options?: UseMutationOptions<AdminCreateCustomersResponse, Error, AdminCreateCustomer[]>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (payload) => createCustomers(payload),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: customersQueryKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create customer', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateCustomer = (
  options?: UseMutationOptions<AdminCustomerResponse, Error, { id: string; data?: AdminUpdateCustomer }>,
) => {
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
      toast.add({ type: 'error', title: 'Failed to update customer', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteCustomer = (options?: UseMutationOptions<DeleteResponse, Error, { id: string }>) => {
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
      toast.add({ type: 'error', title: 'Failed to delete customer', description: error.message })
      onError?.(...args)
    },
  })
}
