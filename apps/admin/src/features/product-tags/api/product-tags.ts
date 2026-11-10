import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import type {
  AdminCreateProductTag,
  AdminProductTag,
  AdminProductTagResponse,
  AdminUpdateProductTag,
  DeleteResponse,
  ListProductTagsParams,
} from '#/api/generated/model'
import {
  createProductTag,
  deleteProductTag,
  getProductTag,
  listProductTags,
  updateProductTag,
} from '#/api/generated/product-tags/product-tags'
import { productKeys } from '#/features/products/api/products'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const productTagKeys = queryKeysFactory<'productTags', ListProductTagsParams>('productTags')

/** Every Tag at once, for the product form. Its own factory: the cached value is an array, not a page. */
const productTagOptionKeys = queryKeysFactory<'productTagOptions'>('productTagOptions')

/** The list endpoint's ceiling, which is also the page the walk over every Tag reads at a time. */
const MAX_PAGE_SIZE = 100

export const productTagsListQueryOptions = (params?: ListProductTagsParams) =>
  queryOptions({
    queryKey: productTagKeys.list(params),
    queryFn: () => listProductTags(params),
    placeholderData: keepPreviousData,
  })

export const productTagQueryOptions = (id: string) =>
  queryOptions({
    queryKey: productTagKeys.detail(id),
    queryFn: () => getProductTag(id),
  })

/**
 * Every Tag, walked page by page — what the product form's multi-select offers. A shop has tens of
 * Tags, so this is a request or two.
 */
export const allProductTagsQueryOptions = () =>
  queryOptions({
    queryKey: productTagOptionKeys.list(),
    queryFn: async () => {
      const tags: AdminProductTag[] = []
      for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
        const page = await listProductTags({ offset, limit: MAX_PAGE_SIZE, order: 'value' })
        tags.push(...page.tags)
        if (offset + MAX_PAGE_SIZE >= page.count) return tags
      }
    },
  })

export const useProductTags = (params?: ListProductTagsParams) => useQuery(productTagsListQueryOptions(params))

export const useSuspenseProductTag = (id: string) => useSuspenseQuery(productTagQueryOptions(id))

export const useSuspenseAllProductTags = () => useSuspenseQuery(allProductTagsQueryOptions())

export const useCreateProductTag = (
  options?: UseMutationOptions<AdminProductTagResponse, Error, AdminCreateProductTag>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductTag) => createProductTag(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTagKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTagOptionKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to create tag`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateProductTag = (
  id: string,
  options?: UseMutationOptions<AdminProductTagResponse, Error, AdminUpdateProductTag>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductTag) => updateProductTag(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTagKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: productTagKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTagOptionKeys.all })
      // Products embed their Tags, values and all.
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update tag`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteProductTag = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductTag(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productTagKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productTagOptionKeys.all })
      // Its products lose it, so neither their Tags nor a list filtered by it still hold.
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete tag`, description: error.message })
      onError?.(...args)
    },
  })
}
