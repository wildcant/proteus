import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminCreateProductVariant,
  AdminUpdateProductVariant,
  AdminUpdateVariantPrices,
  ListProductVariantsParams,
} from '#/api/generated/model'
import {
  createProductVariant,
  deleteProductVariant,
  getProductVariant,
  listProductVariants,
  updateProductVariant,
  updateVariantPrices,
} from '#/api/generated/product-variants/product-variants'
import { queryKeysFactory } from '#/lib/query-key-factory'

const variantKeys = queryKeysFactory<'product-variants', ListProductVariantsParams & { productId: string }>(
  'product-variants',
)

export const productVariantsListQueryOptions = (productId: string, params?: ListProductVariantsParams) =>
  queryOptions({
    queryKey: variantKeys.list({ ...params, productId }),
    queryFn: () => listProductVariants(productId, params),
    placeholderData: keepPreviousData,
  })

export const productVariantQueryOptions = (productId: string, variantId: string) =>
  queryOptions({
    queryKey: variantKeys.detail(variantId),
    queryFn: () => getProductVariant(productId, variantId),
  })

export const useProductVariants = (productId: string, params?: ListProductVariantsParams) =>
  useQuery(productVariantsListQueryOptions(productId, params))

export const useProductVariant = (productId: string, variantId: string) =>
  useQuery(productVariantQueryOptions(productId, variantId))

export const useCreateProductVariant = (productId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AdminCreateProductVariant) => createProductVariant(productId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
    },
  })
}

export const useUpdateProductVariant = (productId: string, variantId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AdminUpdateProductVariant) => updateProductVariant(productId, variantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variantId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
    },
  })
}

export const useDeleteProductVariant = (productId: string, variantId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deleteProductVariant(productId, variantId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
    },
  })
}

export const useUpdateVariantPrices = (productId: string, variantId: string) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: AdminUpdateVariantPrices) => updateVariantPrices(productId, variantId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variantId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
    },
  })
}
