import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
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

const productKeys = queryKeysFactory<'products', ListProductsParams>('products')

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

export const useProducts = (params?: ListProductsParams) => useQuery(productsListQueryOptions(params))

export const useProduct = (id: string) => useQuery(productQueryOptions(id))

export const useCreateProduct = (
  options?: UseMutationOptions<AdminCreateProductResponse, Error, AdminCreateProduct>,
) => {
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
      toast.add({ type: 'error', title: 'Failed to create product', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProduct = (
  id: string,
  options?: UseMutationOptions<AdminUpdateProductResponse, Error, AdminUpdateProduct>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProduct) => updateProduct(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update product', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProduct = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
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
      toast.add({ type: 'error', title: 'Failed to delete product', description: error.message })
      onError?.(...args)
    },
  })
}
