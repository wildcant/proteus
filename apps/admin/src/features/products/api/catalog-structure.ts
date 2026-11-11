import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import type { AdminApplyCatalogStructure, AdminCatalogStructureResponse } from '#/api/generated/model'
import { applyCatalogStructure, previewCatalogStructure } from '#/api/generated/products/products'
import { queryClient } from '#/lib/query-client'

/** Reads an uploaded structure file against the catalogue. Writes nothing, so it invalidates nothing. */
export const usePreviewCatalogStructure = (
  options?: UseMutationOptions<AdminCatalogStructureResponse, Error, AdminApplyCatalogStructure>,
) => {
  const { t } = useLingui()
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminApplyCatalogStructure) => previewCatalogStructure(data),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to read the structure file`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useApplyCatalogStructure = (
  options?: UseMutationOptions<AdminCatalogStructureResponse, Error, AdminApplyCatalogStructure>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminApplyCatalogStructure) => applyCatalogStructure(data),
    onSuccess: (...args) => {
      // Categories, Collections and every product's memberships may all have changed.
      queryClient.invalidateQueries()
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to apply the structure file`, description: error.message })
      onError?.(...args)
    },
  })
}
