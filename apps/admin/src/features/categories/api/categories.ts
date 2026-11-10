import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { queryOptions, useMutation, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminCreateProductCategory,
  AdminProductCategoryResponse,
  AdminSetCategoryProducts,
  AdminUpdateProductCategory,
  DeleteResponse,
} from '#/api/generated/model'
import {
  createProductCategory,
  deleteProductCategory,
  getProductCategory,
  listProductCategoryTree,
  setProductCategoryProducts,
  updateProductCategory,
} from '#/api/generated/product-categories/product-categories'
import { categoryMemberKeys, productKeys } from '#/features/products/api/products'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const categoryKeys = queryKeysFactory<'productCategories'>('productCategories')

/** The whole tree in one request — a shop has tens of Categories, so it is never paginated. */
export const categoryTreeQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: () => listProductCategoryTree(),
  })

export const categoryQueryOptions = (id: string) =>
  queryOptions({
    queryKey: categoryKeys.detail(id),
    queryFn: () => getProductCategory(id),
  })

export const useSuspenseCategoryTree = () => useSuspenseQuery(categoryTreeQueryOptions())

export const useSuspenseCategory = (id: string) => useSuspenseQuery(categoryQueryOptions(id))

export const useCreateCategory = (
  options?: UseMutationOptions<AdminProductCategoryResponse, Error, AdminCreateProductCategory>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductCategory) => createProductCategory(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to create category`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateCategory = (
  id: string,
  options?: UseMutationOptions<AdminProductCategoryResponse, Error, AdminUpdateProductCategory>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductCategory) => updateProductCategory(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update category`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteCategory = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductCategory(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() })
      // Its memberships go with it, so every product embedding it is stale.
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete category`, description: error.message })
      onError?.(...args)
    },
  })
}

/** Adds then removes direct members. Every product read is refreshed: lists, detail embeds and member ids. */
export const useSetCategoryProducts = (
  id: string,
  options?: UseMutationOptions<AdminProductCategoryResponse, Error, AdminSetCategoryProducts>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminSetCategoryProducts) => setProductCategoryProducts(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: categoryMemberKeys.detail(id) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update the category's products`, description: error.message })
      onError?.(...args)
    },
  })
}
