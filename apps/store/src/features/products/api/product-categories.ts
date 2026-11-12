import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { listStoreProductCategoryTree } from '#/api/generated/product-categories/product-categories'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The Visible Category tree. The menu's Category entries resolve against it (with no menu, its top
 * level is the menu), and the category page resolves its Category from it, whether or not the menu
 * names that Category.
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
