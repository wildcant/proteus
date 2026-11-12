import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { listStoreProductCollections } from '#/api/generated/collections/collections'
import type { ListStoreProductCollectionsParams, StoreProductCollection } from '#/api/generated/model'
import { queryKeysFactory } from '#/lib/query-key-factory'

const collectionKeys = queryKeysFactory<'store-collections', ListStoreProductCollectionsParams>('store-collections')

/** The answer for one handle, with the Collection absent when the store has none under it. */
type CollectionByHandle = { collection: StoreProductCollection | undefined }

/**
 * Shared query config. Use in route loaders via `ensureQueryData(collectionQueryOptions(handle))`.
 *
 * Read through the list filtered by handle, because handles are what a storefront URL carries: an
 * unknown handle is an empty list, which resolves to no Collection rather than an error.
 */
export const collectionQueryOptions = (handle: string) =>
  queryOptions({
    queryKey: collectionKeys.detail(handle),
    queryFn: async (): Promise<CollectionByHandle> => ({
      collection: (await listStoreProductCollections({ handle })).collections[0],
    }),
  })

/** Suspends until the Collection resolves — which, on the collection page, its loader has already awaited. */
export const useSuspenseCollection = (handle: string) => useSuspenseQuery(collectionQueryOptions(handle)).data
