import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useSuspenseQuery } from '@tanstack/react-query'
import type { AdminCreateProductImport, AdminProductImportResponse } from '#/api/generated/model'
import {
  cancelProductImport,
  confirmProductImport,
  createProductImport,
  getProductImport,
} from '#/api/generated/products/products'
import { productIdKeys, productKeys } from '#/features/products/api/products'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productImportKeys = queryKeysFactory('productImports')

/** How often a running import is re-read while the merchant watches it. */
const IMPORT_POLL_INTERVAL_MS = 1500

const refreshImportedProducts = () => {
  queryClient.invalidateQueries({ queryKey: productKeys.lists() })
  // Imported products may already sit in Categories and Collections.
  queryClient.invalidateQueries({ queryKey: productIdKeys.all })
}

/**
 * One import job. Polls for as long as it is importing; the read that sees it finish refreshes the
 * product list, since that is the moment the catalogue the list shows has changed.
 */
export const productImportQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productImportKeys.detail(id),
    queryFn: async () => {
      const response = await getProductImport(id)
      if (response.productImport.status === 'completed' || response.productImport.status === 'failed') {
        refreshImportedProducts()
      }
      return response
    },
    refetchInterval: (query) =>
      query.state.data?.productImport.status === 'importing' ? IMPORT_POLL_INTERVAL_MS : false,
  })

export const useSuspenseProductImport = (id: string) => useSuspenseQuery(productImportQueryOptions(id))

const seedProductImport = (response: AdminProductImportResponse) => {
  queryClient.setQueryData(productImportKeys.detail(response.productImport.id), response)
}

export const useCreateProductImport = (
  options?: UseMutationOptions<AdminProductImportResponse, Error, AdminCreateProductImport>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductImport) => createProductImport(data),
    onSuccess: (...args) => {
      seedProductImport(args[0])
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to read the CSV file`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useConfirmProductImport = (
  id: string,
  options?: UseMutationOptions<AdminProductImportResponse, Error, void>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => confirmProductImport(id),
    onSuccess: (...args) => {
      // The answer is the job, now importing — seeding it is what starts the progress view polling.
      seedProductImport(args[0])
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to start the import`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useCancelProductImport = (
  id: string,
  options?: UseMutationOptions<AdminProductImportResponse, Error, void>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => cancelProductImport(id),
    onSuccess: (...args) => {
      seedProductImport(args[0])
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to cancel the import`, description: error.message })
      onError?.(...args)
    },
  })
}
