import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminBatchImageVariant,
  AdminBatchImageVariantResponse,
  AdminBatchVariantImages,
  AdminBatchVariantImagesResponse,
  AdminCreateProductVariant,
  AdminCreateProductVariantResponse,
  AdminCreateProductVariantsBatch,
  AdminCreateProductVariantsBatchResponse,
  AdminUpdateProductVariant,
  AdminUpdateProductVariantResponse,
  AdminUpdateVariantPrices,
  AdminUpdateVariantPricesResponse,
  DeleteResponse,
  ListOptionCombinationsParams,
  ListProductVariantsParams,
} from '#/api/generated/model'
import {
  batchVariantImages,
  createProductVariant,
  createProductVariantsBatch,
  deleteProductVariant,
  getProductVariant,
  listOptionCombinations,
  listProductVariants,
  updateProductVariant,
  updateVariantPrices,
} from '#/api/generated/product-variants/product-variants'
import { batchImageVariants, listImageVariants } from '#/api/generated/products/products'
import { queryKeysFactory } from '#/lib/query-key-factory'

const variantKeys = queryKeysFactory<'product-variants', ListProductVariantsParams & { productId: string }>(
  'product-variants',
)

const combinationKeys = queryKeysFactory<'option-combinations', ListOptionCombinationsParams & { productId: string }>(
  'option-combinations',
)

// Keyed by product + image, since an image's variant links are scoped to both.
const imageVariantKeys = queryKeysFactory<'image-variants'>('image-variants')

export const imageVariantsQueryOptions = (productId: string, imageId: string) =>
  queryOptions({
    queryKey: imageVariantKeys.detail(`${productId}:${imageId}`),
    queryFn: () => listImageVariants(productId, imageId),
  })

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

/**
 * Every Option Combination the product could sell, each naming the variant that has it or `null`
 * while it is still available.
 *
 * One list drives every option-picking surface: create takes the free ones, edit takes those plus
 * the variant's own. Searched and paginated server-side because the count is the product of the
 * option value counts.
 */
export const optionCombinationsQueryOptions = (productId: string, params?: ListOptionCombinationsParams) =>
  queryOptions({
    queryKey: combinationKeys.list({ ...params, productId }),
    queryFn: () => listOptionCombinations(productId, params),
    placeholderData: keepPreviousData,
  })

export const useOptionCombinations = (productId: string, params?: ListOptionCombinationsParams) =>
  useQuery(optionCombinationsQueryOptions(productId, params))

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
      // A new variant takes a combination, so the list of free ones is now stale.
      queryClient.invalidateQueries({ queryKey: combinationKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create variant', description: error.message })
      onError?.(...args)
    },
  })
}

/**
 * Creates a whole option matrix in one request, so the duplicate check sees every row together.
 *
 * Unused since the create-variant modal became one-variant-at-a-time; kept for the matrix step of
 * a product-create wizard, which is the flow that actually needs a batch.
 */
export const useCreateProductVariantsBatch = (
  productId: string,
  options?: UseMutationOptions<AdminCreateProductVariantsBatchResponse, Error, AdminCreateProductVariantsBatch>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductVariantsBatch) => createProductVariantsBatch(productId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create variants', description: error.message })
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
      // Moving a variant frees its old combination and takes a new one.
      queryClient.invalidateQueries({ queryKey: combinationKeys.all })
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
      // Deleting a variant releases its combination.
      queryClient.invalidateQueries({ queryKey: combinationKeys.all })
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

/**
 * Links and unlinks variants for one product image.
 *
 * The workflow clears a variant's thumbnail when it loses the image that thumbnail pointed at,
 * so the variant caches go stale alongside the product's.
 */
export const useBatchImageVariants = (
  productId: string,
  imageId: string,
  options?: UseMutationOptions<AdminBatchImageVariantResponse, Error, AdminBatchImageVariant>,
) => {
  const queryClient = useQueryClient()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminBatchImageVariant) => batchImageVariants(productId, imageId, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: imageVariantKeys.detail(`${productId}:${imageId}`) })
      queryClient.invalidateQueries({ queryKey: variantKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update image variants', description: error.message })
      onError?.(...args)
    },
  })
}
