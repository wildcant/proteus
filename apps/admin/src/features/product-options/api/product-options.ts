import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type {
  AdminCreateProductOption,
  AdminProductOptionResponse,
  AdminSetProductOptions,
  AdminSetProductOptionsResponse,
  AdminUpdateProductOption,
  DeleteResponse,
  ListProductOptionsParams,
  ListProductsForOptionParams,
  ListValuesForOptionParams,
} from '#/api/generated/model'
import {
  createProductOption,
  deleteProductOption,
  getProductOption,
  getProductOptions,
  listProductOptions,
  listProductsForOption,
  listValuesForOption,
  setProductOptions,
  updateProductOption,
} from '#/api/generated/product-options/product-options'
import { combinationKeys, variantKeys } from '#/features/products/api/product-variants'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productOptionKeys = queryKeysFactory<'productOptions', ListProductOptionsParams>('productOptions')

export const productOptionsListQueryOptions = (params?: ListProductOptionsParams) =>
  queryOptions({
    queryKey: productOptionKeys.list(params),
    queryFn: () => listProductOptions(params),
    placeholderData: keepPreviousData,
  })

export const productOptionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productOptionKeys.detail(id),
    queryFn: () => getProductOption(id),
  })

export const useProductOptions = (params?: ListProductOptionsParams) => useQuery(productOptionsListQueryOptions(params))

export const useProductOption = (id: string) => useQuery(productOptionQueryOptions(id))

export const useCreateProductOption = (
  options?: UseMutationOptions<AdminProductOptionResponse, Error, AdminCreateProductOption>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductOption) => createProductOption(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create option', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProductOption = (
  id: string,
  options?: UseMutationOptions<AdminProductOptionResponse, Error, AdminUpdateProductOption>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductOption) => updateProductOption(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: valuesForOptionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productOptionsForProductKeys.all })
      // Renaming a value retitles every variant carrying it.
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({ queryKey: combinationKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update option', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProductOption = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductOption(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to delete option', description: error.message })
      onError?.(...args)
    },
  })
}

const productsForOptionKeys = queryKeysFactory<'productsForOption', ListProductsForOptionParams & { optionId: string }>(
  'productsForOption',
)

export const productsForOptionQueryOptions = (optionId: string, params?: ListProductsForOptionParams) =>
  queryOptions({
    queryKey: productsForOptionKeys.list({ ...params, optionId }),
    queryFn: () => listProductsForOption(optionId, params),
    placeholderData: keepPreviousData,
  })

export const useProductsForOption = (optionId: string, params?: ListProductsForOptionParams) =>
  useQuery(productsForOptionQueryOptions(optionId, params))

const valuesForOptionKeys = queryKeysFactory<'valuesForOption', ListValuesForOptionParams & { optionId: string }>(
  'valuesForOption',
)

export const valuesForOptionQueryOptions = (optionId: string, params?: ListValuesForOptionParams) =>
  queryOptions({
    queryKey: valuesForOptionKeys.list({ ...params, optionId }),
    queryFn: () => listValuesForOption(optionId, params),
    placeholderData: keepPreviousData,
  })

export const useValuesForOption = (optionId: string, params?: ListValuesForOptionParams) =>
  useQuery(valuesForOptionQueryOptions(optionId, params))

const productOptionsForProductKeys = queryKeysFactory<'productOptionsForProduct'>('productOptionsForProduct')

export const productOptionsForProductQueryOptions = (productId: string) =>
  queryOptions({
    queryKey: productOptionsForProductKeys.detail(productId),
    queryFn: () => getProductOptions(productId),
  })

export const useProductOptionsForProduct = (productId: string) =>
  useQuery(productOptionsForProductQueryOptions(productId))

export const useSetProductOptions = (
  productId: string,
  options?: UseMutationOptions<AdminSetProductOptionsResponse, Error, AdminSetProductOptions>,
) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminSetProductOptions) => setProductOptions(productId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productOptionsForProductKeys.detail(productId) })
      // The save reconciles the variants: some were created, some reassigned, some deleted.
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      queryClient.invalidateQueries({ queryKey: combinationKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to set product options', description: error.message })
      onError?.(...args)
    },
  })
}
