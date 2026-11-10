import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminCreateProductType,
  AdminProductTypeResponse,
  AdminUpdateProductType,
  DeleteResponse,
  ListProductTypesParams,
} from '#/api/generated/model'
import {
  createProductType,
  deleteProductType,
  getProductType,
  listProductTypes,
  updateProductType,
} from '#/api/generated/product-types/product-types'
import { productKeys } from '#/features/products/api/products'
import { listEveryPage } from '#/lib/list-every-page'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productTypeKeys = queryKeysFactory<'productTypes', ListProductTypesParams>('productTypes')

/** Every Type at once, for the product form. Its own factory: the cached value is an array, not a page. */
const productTypeOptionKeys = queryKeysFactory<'productTypeOptions'>('productTypeOptions')

export const productTypesListQueryOptions = (params?: ListProductTypesParams) =>
  queryOptions({
    queryKey: productTypeKeys.list(params),
    queryFn: () => listProductTypes(params),
    placeholderData: keepPreviousData,
  })

export const productTypeQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productTypeKeys.detail(id),
    queryFn: () => getProductType(id),
  })

/**
 * Every Type, walked page by page — what the product form's single-select offers. A shop has tens
 * of Types, so this is a request or two.
 */
export const allProductTypesQueryOptions = () =>
  queryOptions({
    queryKey: productTypeOptionKeys.list(),
    queryFn: () =>
      listEveryPage(
        (range) => listProductTypes({ ...range, order: 'value' }),
        (page) => page.types,
      ),
  })

export const useProductTypes = (params?: ListProductTypesParams) => useQuery(productTypesListQueryOptions(params))

export const useSuspenseProductType = (id: string) => useSuspenseQuery(productTypeQueryOptions(id))

export const useSuspenseAllProductTypes = () => useSuspenseQuery(allProductTypesQueryOptions())

export const useCreateProductType = (
  options?: UseMutationOptions<AdminProductTypeResponse, Error, AdminCreateProductType>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductType) => createProductType(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTypeKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTypeOptionKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to create type`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProductType = (
  id: string,
  options?: UseMutationOptions<AdminProductTypeResponse, Error, AdminUpdateProductType>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductType) => updateProductType(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTypeKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productTypeKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTypeOptionKeys.all })
      // Products embed their Type, value and all.
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update type`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProductType = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductType(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTypeKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTypeOptionKeys.all })
      // Its products read no Type from now on.
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete type`, description: error.message })
      onError?.(...args)
    },
  })
}
