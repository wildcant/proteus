import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminCreateProduct,
  AdminCreateProductResponse,
  AdminUpdateProduct,
  AdminUpdateProductResponse,
  DeleteResponse,
  ListProductsParams,
} from '#/api/generated/model'
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '#/api/generated/products/products'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

/** Exported so a write elsewhere that changes what a product embeds can invalidate it. */
export const productKeys = queryKeysFactory<'products', ListProductsParams>('products')

/** Who is directly in each Category, by id. Its own factory: the cached value is an id list, not a page. */
export const categoryMemberKeys = queryKeysFactory<'categoryMembers'>('categoryMembers')

/** The list endpoint's ceiling, which is also the page the member-id walk reads at a time. */
const MAX_PAGE_SIZE = 100

export const productsListQueryOptions = (params?: ListProductsParams) =>
  queryOptions({
    queryKey: productKeys.list(params),
    queryFn: () => listProducts(params),
    placeholderData: keepPreviousData,
  })

export const productQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => getProduct(id),
  })

/**
 * Every direct member of a Category, as ids, walked page by page — what the product picker
 * pre-checks. A Category holds tens of products, so this is a request or two.
 */
export const productIdsInCategoryQueryOptions = (categoryId: string) =>
  queryOptions({
    queryKey: categoryMemberKeys.detail(categoryId),
    queryFn: async () => {
      const ids: string[] = []
      for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
        const page = await listProducts({ categoryId, offset, limit: MAX_PAGE_SIZE })
        ids.push(...page.products.map((product) => product.id))
        if (offset + MAX_PAGE_SIZE >= page.count) return ids
      }
    },
  })

export const useProducts = (params?: ListProductsParams) => useQuery(productsListQueryOptions(params))

export const useSuspenseProductIdsInCategory = (categoryId: string) =>
  useSuspenseQuery(productIdsInCategoryQueryOptions(categoryId))

export const useSuspenseProduct = (id: string) => useSuspenseQuery(productQueryOptions(id))

export const useCreateProduct = (
  options?: UseMutationOptions<AdminCreateProductResponse, Error, AdminCreateProduct>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProduct) => createProduct(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to create product`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProduct = (
  id: string,
  options?: UseMutationOptions<AdminUpdateProductResponse, Error, AdminUpdateProduct>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProduct) => updateProduct(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      // `categoryIds` may have moved the product between Categories.
      queryClient.invalidateQueries({ queryKey: categoryMemberKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update product`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProduct = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProduct(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete product`, description: error.message })
      onError?.(...args)
    },
  })
}
