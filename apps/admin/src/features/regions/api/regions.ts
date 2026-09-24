import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminCreateRegion,
  AdminRegionResponse,
  AdminUpdateRegion,
  ListRegionsParams,
} from '#/api/generated/model'
import { createRegion, getRegion, listRegions, updateRegion } from '#/api/generated/regions/regions'
import { queryClient, REFERENCE_DATA_STALE_TIME } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * Exported because the country screens invalidate it too: assigning or removing a country changes
 * what the region's own card lists, so both caches move together.
 */
export const regionKeys = queryKeysFactory<'regions', ListRegionsParams>('regions')

export const regionsListQueryOptions = (params?: ListRegionsParams) =>
  queryOptions({
    queryKey: regionKeys.list(params),
    queryFn: () => listRegions(params),
    placeholderData: keepPreviousData,
    staleTime: REFERENCE_DATA_STALE_TIME,
  })

export const regionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: regionKeys.detail(id),
    queryFn: () => getRegion(id),
    staleTime: REFERENCE_DATA_STALE_TIME,
  })

export const useRegions = (params?: ListRegionsParams) => useQuery(regionsListQueryOptions(params))

export const useSuspenseRegion = (id: string) => useSuspenseQuery(regionQueryOptions(id))

export const useSuspenseRegions = (params?: ListRegionsParams) => useSuspenseQuery(regionsListQueryOptions(params))

export const useCreateRegion = (options?: UseMutationOptions<AdminRegionResponse, Error, AdminCreateRegion>) => {
  const { t } = useLingui()
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
      toast.add({ type: 'error', title: t`Failed to create region`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateRegion = (
  id: string,
  options?: UseMutationOptions<AdminRegionResponse, Error, AdminUpdateRegion>,
) => {
  const { t } = useLingui()
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
      toast.add({ type: 'error', title: t`Failed to update region`, description: error.message })
      onError?.(...args)
    },
  })
}
