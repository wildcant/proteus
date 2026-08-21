import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminBatchVariantImages,
  AdminBatchVariantImagesResponse,
  AdminCreateProductVariant,
  AdminCreateProductVariantResponse,
  AdminUpdateProductVariant,
  AdminUpdateProductVariantResponse,
  AdminUpdateVariantPrices,
  AdminUpdateVariantPricesResponse,
  DeleteResponse,
  ListProductVariantsParams,
} from '#/api/generated/model'
import {
  batchVariantImages,
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

export const useCreateProductVariant = (
  productId: string,
  options?: UseMutationOptions<AdminCreateProductVariantResponse, Error, AdminCreateProductVariant>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductVariant) => createProductVariant(productId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create variant', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProductVariant = (
  productId: string,
  variantId: string,
  options?: UseMutationOptions<AdminUpdateProductVariantResponse, Error, AdminUpdateProductVariant>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductVariant) => updateProductVariant(productId, variantId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variantId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update variant', description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProductVariant = (
  productId: string,
  variantId: string,
  options?: UseMutationOptions<DeleteResponse, Error, void>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductVariant(productId, variantId),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to delete variant', description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateVariantPrices = (
  productId: string,
  variantId: string,
  options?: UseMutationOptions<AdminUpdateVariantPricesResponse, Error, AdminUpdateVariantPrices>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateVariantPrices) => updateVariantPrices(productId, variantId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variantId) })
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update variant prices', description: error.message })
      onError?.(...args)
    },
  })
}

/** Links and unlinks product images for one variant in a single atomic request. */
export const useBatchVariantImages = (
  productId: string,
  variantId: string,
  options?: UseMutationOptions<AdminBatchVariantImagesResponse, Error, AdminBatchVariantImages>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminBatchVariantImages) => batchVariantImages(productId, variantId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.detail(variantId) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update variant images', description: error.message })
      onError?.(...args)
    },
  })
}
