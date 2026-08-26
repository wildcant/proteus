import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import {
  createStoreCustomerAddress,
  deleteStoreCustomerAddress,
  listStoreCustomerAddresses,
  updateStoreCustomerAddress,
} from '#/api/generated/customers/customers'
import type {
  DeleteResponse,
  StoreCreateAddress,
  StoreCustomerAddressResponse,
  StoreUpdateAddress,
} from '#/api/generated/model'
import { isRegistered } from '#/lib/auth-token'
import { queryKeysFactory } from '#/lib/query-key-factory'

export const addressesQueryKeys = queryKeysFactory('customer-addresses')

export const addressesQueryOptions = () =>
  queryOptions({
    queryKey: addressesQueryKeys.lists(),
    queryFn: () => listStoreCustomerAddresses(),
    // Same reason as customerMeQueryOptions: an unregistered signup token can never satisfy a
    // customer-scoped endpoint, and the 401 would clear the session.
    enabled: isRegistered(),
  })

export const useSuspenseAddresses = () => {
  const { data, ...rest } = useSuspenseQuery(addressesQueryOptions())
  return { addresses: data.addresses, ...rest }
}

/**
 * The non-suspending twin, for a surface the list does not own. Checkout reads it beside the cart
 * and must not hold the page on it — and a guest, for whom the query is disabled, must reach the
 * address form with no wait at all.
 */
export const useAddresses = () => {
  const { data, ...rest } = useQuery(addressesQueryOptions())
  return { addresses: data?.addresses ?? [], ...rest }
}

export const useCreateAddress = (
  options?: UseMutationOptions<StoreCustomerAddressResponse, Error, StoreCreateAddress>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: (payload: StoreCreateAddress) => createStoreCustomerAddress(payload),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to add address', description: error.message })
      onError?.(...args)
    },
  })
}

type UpdateAddressVariables = { addressId: string; payload: StoreUpdateAddress }

export const useUpdateAddress = (
  options?: UseMutationOptions<StoreCustomerAddressResponse, Error, UpdateAddressVariables>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: ({ addressId, payload }: UpdateAddressVariables) => updateStoreCustomerAddress(addressId, payload),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to save address', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteAddress = (options?: UseMutationOptions<DeleteResponse, Error, string>) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}

  return useMutation({
    ...rest,
    mutationFn: (addressId: string) => deleteStoreCustomerAddress(addressId),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: addressesQueryKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to remove address', description: error.message })
      onError?.(...args)
    },
  })
}
