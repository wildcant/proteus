import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type {
  AdminCreateRegion,
  AdminRegionResponse,
  AdminUpdateRegion,
  ListRegionsParams,
} from '#/api/generated/model'
import { createRegion, getRegion, listRegions, updateRegion } from '#/api/generated/regions/regions'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const regionKeys = queryKeysFactory<'regions', ListRegionsParams>('regions')

export const regionsListQueryOptions = (params?: ListRegionsParams) =>
  queryOptions({
    queryKey: regionKeys.list(params),
    queryFn: () => listRegions(params),
    placeholderData: keepPreviousData,
  })

export const regionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: regionKeys.detail(id),
    queryFn: () => getRegion(id),
  })

export const useRegions = (params?: ListRegionsParams) => useQuery(regionsListQueryOptions(params))

export const useRegion = (id: string) => useQuery(regionQueryOptions(id))

export const useCreateRegion = (options?: UseMutationOptions<AdminRegionResponse, Error, AdminCreateRegion>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateRegion) => createRegion(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: regionKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create region', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateRegion = (
  id: string,
  options?: UseMutationOptions<AdminRegionResponse, Error, AdminUpdateRegion>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateRegion) => updateRegion(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: regionKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: regionKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update region', description: error.message })
      onError?.(...args)
    },
  })
}
