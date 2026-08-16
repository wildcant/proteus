import { keepPreviousData, queryOptions, useMutation, useQuery } from '@tanstack/react-query'
import type {
  AdminCreateProductOption,
  AdminSetProductOptions,
  AdminUpdateProductOption,
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

export const useCreateProductOption = () => {
  return useMutation({
    mutationFn: (data: AdminCreateProductOption) => createProductOption(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
    },
  })
}

export const useUpdateProductOption = (id: string) => {
  return useMutation({
    mutationFn: (data: AdminUpdateProductOption) => updateProductOption(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: valuesForOptionKeys.lists() })
    },
  })
}

export const useDeleteProductOption = (id: string) => {
  return useMutation({
    mutationFn: () => deleteProductOption(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productOptionKeys.lists() })
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

export const useSetProductOptions = (productId: string) => {
  return useMutation({
    mutationFn: (data: AdminSetProductOptions) => setProductOptions(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productOptionsForProductKeys.detail(productId) })
    },
  })
}
