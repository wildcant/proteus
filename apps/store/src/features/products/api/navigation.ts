import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { listStoreProductCollections } from '#/api/generated/collections/collections'
import type { GetStoreNavigationParams, StoreNavigationEntry, StoreProductCollection } from '#/api/generated/model'
import { getStoreNavigation } from '#/api/generated/store/store'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The store's menu as the structure file set it, with the Collections it names: an entry carries
 * only a handle, and the menu links a Collection by its title. Category entries resolve against
 * the Category tree, which the `_main` loader reads alongside this; their sections come resolved.
 *
 * Like the tree, the `_main` layout reads this and hands it to the shared header and footer as a prop.
 */

const navigationQueryKeys = queryKeysFactory<'store-navigation', GetStoreNavigationParams>('store-navigation')

type Navigation = { navigation: StoreNavigationEntry[]; collections: StoreProductCollection[] }

/**
 * Shared query config. Use in route loaders via `ensureQueryData(navigationQueryOptions(countryCode))`.
 * `countryCode` is required because a section's values are those of the products this market sells.
 */
export const navigationQueryOptions = (countryCode: string) =>
  queryOptions({
    queryKey: navigationQueryKeys.list({ countryCode }),
    queryFn: async (): Promise<Navigation> => {
      const { navigation } = await getStoreNavigation({ countryCode })
      const handles = navigation.filter((entry) => entry.type === 'collection').map((entry) => entry.handle)
      if (handles.length === 0) return { navigation, collections: [] }
      // One request for every Collection on the menu; 100 is the list's ceiling and far above any menu.
      const { collections } = await listStoreProductCollections({ handle: handles, limit: 100 })
      return { navigation, collections }
    },
  })

/** Suspends until the menu resolves — which, under `_main`, its loader has already awaited. */
export const useSuspenseNavigation = (countryCode: string) => useSuspenseQuery(navigationQueryOptions(countryCode)).data
