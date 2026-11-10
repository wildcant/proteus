import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { listStoreProductCategoryTree } from '#/api/generated/product-categories/product-categories'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The Visible Category tree, which is the storefront's navigation: the header rail, the side menu
 * and the footer all draw from it, and the category page resolves its Category from it.
 *
 * The chrome is shared and may not import a feature, so the `_main` layout reads the tree here and
 * hands it to the header and footer as a prop. Fetched once in the `_main` loader; a child loader
 * asking for it again through `ensureQueryData` joins that request rather than making its own.
 */

// `never`: the endpoint takes no params, so no key has a query slot to type.
const categoryTreeQueryKeys = queryKeysFactory<'store-product-categories', never>('store-product-categories')

/** Shared query config. Use in route loaders via `ensureQueryData(categoryTreeQueryOptions())`. */
export const categoryTreeQueryOptions = () =>
  queryOptions({
    queryKey: categoryTreeQueryKeys.lists(),
    queryFn: async () => (await listStoreProductCategoryTree()).productCategories,
  })

/** Suspends until the tree resolves — which, under `_main`, its loader has already awaited. */
export const useSuspenseCategoryTree = () => useSuspenseQuery(categoryTreeQueryOptions()).data
