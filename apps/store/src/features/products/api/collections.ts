import type { UseQueryOptions } from '@tanstack/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { listStoreProductCollections } from '#/api/generated/collections/collections'
import type { ListStoreProductCollectionsParams, StoreProductCollection } from '#/api/generated/model'
import { queryKeysFactory } from '#/lib/query-key-factory'

const collectionKeys = queryKeysFactory<'store-collections', ListStoreProductCollectionsParams>('store-collections')

/** The answer for one handle, with the Collection absent when the store has none under it. */
type CollectionByHandle = { collection: StoreProductCollection | undefined }

type CollectionQueryOptions = Omit<
  UseQueryOptions<CollectionByHandle, Error, CollectionByHandle>,
  'queryFn' | 'queryKey'
>

/**
 * Shared query config. Use in route loaders via `ensureQueryData(collectionQueryOptions(handle))`.
 *
 * Read through the list filtered by handle, because handles are what a storefront URL carries: an
 * unknown handle is an empty list, which resolves to no Collection rather than an error.
 */
export const collectionQueryOptions = (handle: string, options?: CollectionQueryOptions) =>
  queryOptions({
    queryKey: collectionKeys.detail(handle),
    queryFn: async () => ({ collection: (await listStoreProductCollections({ handle })).collections[0] }),
    ...options,
  })

/** Suspends until the Collection resolves — which, on the collection page, its loader has already awaited. */
export const useSuspenseCollection = (handle: string, options?: CollectionQueryOptions) =>
  useSuspenseQuery(collectionQueryOptions(handle, options)).data
