import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { keepPreviousData, queryOptions, useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query'
import {
  createProductCollection,
  deleteProductCollection,
  getProductCollection,
  listProductCollections,
  setProductCollectionProducts,
  updateProductCollection,
} from '#/api/generated/collections/collections'
import type {
  AdminCreateProductCollection,
  AdminProductCollection,
  AdminProductCollectionResponse,
  AdminSetCollectionProducts,
  AdminUpdateProductCollection,
  DeleteResponse,
  ListProductCollectionsParams,
} from '#/api/generated/model'
import { collectionMemberKeys, productKeys } from '#/features/products/api/products'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const collectionKeys = queryKeysFactory<'collections', ListProductCollectionsParams>('collections')

/** Every Collection at once, for the product form. Its own factory: the cached value is an array, not a page. */
const collectionOptionKeys = queryKeysFactory<'collectionOptions'>('collectionOptions')

/** The list endpoint's ceiling, which is also the page the walk over every Collection reads at a time. */
const MAX_PAGE_SIZE = 100

export const collectionsListQueryOptions = (params?: ListProductCollectionsParams) =>
  queryOptions({
    queryKey: collectionKeys.list(params),
    queryFn: () => listProductCollections(params),
    placeholderData: keepPreviousData,
  })

export const collectionQueryOptions = (id: string) =>
  queryOptions({
    queryKey: collectionKeys.detail(id),
    queryFn: () => getProductCollection(id),
  })

/**
 * Every Collection, walked page by page — what the product form's multi-select offers. A shop has
 * tens of Collections, so this is a request or two.
 */
export const allCollectionsQueryOptions = () =>
  queryOptions({
    queryKey: collectionOptionKeys.list(),
    queryFn: async () => {
      const collections: AdminProductCollection[] = []
      for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
        const page = await listProductCollections({ offset, limit: MAX_PAGE_SIZE, order: 'title' })
        collections.push(...page.collections)
        if (offset + MAX_PAGE_SIZE >= page.count) return collections
      }
    },
  })

export const useCollections = (params?: ListProductCollectionsParams) => useQuery(collectionsListQueryOptions(params))

export const useSuspenseCollection = (id: string) => useSuspenseQuery(collectionQueryOptions(id))

export const useSuspenseAllCollections = () => useSuspenseQuery(allCollectionsQueryOptions())

export const useCreateCollection = (
  options?: UseMutationOptions<AdminProductCollectionResponse, Error, AdminCreateProductCollection>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminCreateProductCollection) => createProductCollection(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: collectionOptionKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to create collection`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useUpdateCollection = (
  id: string,
  options?: UseMutationOptions<AdminProductCollectionResponse, Error, AdminUpdateProductCollection>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUpdateProductCollection) => updateProductCollection(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: collectionOptionKeys.all })
      // Products embed their Collections, title and all.
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update collection`, description: error.message })
      onError?.(...args)
    },
  })
}

export const useDeleteCollection = (id: string, options?: UseMutationOptions<DeleteResponse, Error, void>) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: () => deleteProductCollection(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: collectionOptionKeys.all })
      // Its memberships go with it, so every product embedding it is stale.
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to delete collection`, description: error.message })
      onError?.(...args)
    },
  })
}

/** Adds then removes members. Every product read is refreshed: lists, detail embeds and member ids. */
export const useSetCollectionProducts = (
  id: string,
  options?: UseMutationOptions<AdminProductCollectionResponse, Error, AdminSetCollectionProducts>,
) => {
  const { t } = useLingui()
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminSetCollectionProducts) => setProductCollectionProducts(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: collectionMemberKeys.detail(id) })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to update the collection's products`, description: error.message })
      onError?.(...args)
    },
  })
}
