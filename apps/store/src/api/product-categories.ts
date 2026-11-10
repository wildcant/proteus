import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import type { StoreProductCategoryTreeNode } from '#/api/generated/model'
import { listStoreProductCategoryTree } from '#/api/generated/product-categories/product-categories'
import { queryKeysFactory } from '#/lib/query-key-factory'

/**
 * The Visible Category tree, which is the storefront's navigation: the header rail, the side menu
 * and the footer all draw from it, and the category page resolves its Category from it.
 *
 * A shared layer rather than a feature, because the nav is shared chrome and shared components may
 * not import features. Fetched once in the `_main` loader; a child loader asking for it again
 * through `ensureQueryData` joins that request rather than making its own.
 */

const categoryTreeQueryKeys = queryKeysFactory('store-product-categories')

/** Shared query config. Use in route loaders via `ensureQueryData(categoryTreeQueryOptions())`. */
export const categoryTreeQueryOptions = () =>
  queryOptions({
    queryKey: categoryTreeQueryKeys.lists(),
    queryFn: async () => (await listStoreProductCategoryTree()).productCategories,
  })

/** Suspends until the tree resolves — which, under `_main`, its loader has already awaited. */
export const useSuspenseCategoryTree = () => useSuspenseQuery(categoryTreeQueryOptions()).data

/** A Category as the category page needs it: itself, and the Categories above it, root first. */
type CategoryTrail = { category: StoreProductCategoryTreeNode; ancestors: StoreProductCategoryTreeNode[] }

/** The Category with this handle and its ancestors, or `undefined` when the Visible tree has none. */
export function findCategoryTrail(
  nodes: StoreProductCategoryTreeNode[],
  handle: string,
  ancestors: StoreProductCategoryTreeNode[] = [],
): CategoryTrail | undefined {
  for (const node of nodes) {
    if (node.handle === handle) return { category: node, ancestors }
    const found = findCategoryTrail(node.children, handle, [...ancestors, node])
    if (found) return found
  }
  return undefined
}
