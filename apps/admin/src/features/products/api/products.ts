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
import { listEveryPage } from '#/lib/list-every-page'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

/** Exported so a write elsewhere that changes what a product embeds can invalidate it. */
export const productKeys = queryKeysFactory<'products', ListProductsParams>('products')

/**
 * The ids of the products in one hand-picked group, keyed by the group's filter. Its own factory:
 * the cached value is an id list, not a page.
 */
export const productIdKeys = queryKeysFactory<'productIds', ProductGroupFilter>('productIds')

/** The groups whose members are picked by hand, and so are listed for the product picker to pre-check. */
export type ProductGroupFilter = { categoryId: string } | { collectionId: string }

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
 * Every product in a group, as ids — what the product picker pre-checks. For a Category, only its
 * direct members.
 */
export const productIdsQueryOptions = (filter: ProductGroupFilter) =>
  queryOptions({
    queryKey: productIdKeys.list(filter),
    queryFn: () =>
      listEveryPage(
        (range) => listProducts({ ...filter, ...range }),
        (page) => page.products.map((product) => product.id),
      ),
  })

export const useProducts = (params?: ListProductsParams) => useQuery(productsListQueryOptions(params))

export const useSuspenseProductIds = (filter: ProductGroupFilter) => useSuspenseQuery(productIdsQueryOptions(filter))

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
      // The new product may already sit in Categories and Collections.
      queryClient.invalidateQueries({ queryKey: productIdKeys.all })
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
      // `categoryIds` and `collectionIds` may have moved the product between groupings.
      queryClient.invalidateQueries({ queryKey: productIdKeys.all })
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
