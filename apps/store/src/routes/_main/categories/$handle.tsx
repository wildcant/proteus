import { Trans } from '@lingui/react/macro'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { categoryTreeQueryOptions, useSuspenseCategoryTree } from '#/features/products/api/product-categories'
import { ensureProductListData } from '#/features/products/api/product-list'
import type { ProductListScope } from '#/features/products/api/products'
import { CategoryBreadcrumb } from '#/features/products/components/category-breadcrumb/category-breadcrumb'
import { CategoryIntro } from '#/features/products/components/category-intro/category-intro'
import { ProductListNotFound } from '#/features/products/components/product-list-not-found/product-list-not-found'
import { ProductListPage } from '#/features/products/components/product-list-page/product-list-page'
import { findCategoryTrail } from '#/features/products/utils/category-trail'
import { productListRouteOptions } from '#/features/products/utils/product-list-route'

/** The list is scoped by handle; the backend widens it to the Category's Visible descendants. */
const scopeFor = (handle: string): ProductListScope => ({ category: handle })

export const Route = createFileRoute('/_main/categories/$handle')({
  ssr: true,
  ...productListRouteOptions,
  component: CategoryPage,
  notFoundComponent: CategoryNotFound,
  loader: async ({ context, deps, params }) => {
    // The `_main` loader is fetching the tree alongside this one, so this joins its request rather
    // than making a second: the Category, its ancestors and its children all come from there.
    const tree = await context.queryClient.ensureQueryData(categoryTreeQueryOptions())
    // A handle the Visible tree does not hold answers 404, with no list to load.
    if (!findCategoryTrail(tree, params.handle)) throw notFound()
    await ensureProductListData(context, { ...deps, scope: scopeFor(params.handle) })
  },
})

function CategoryPage() {
  const { handle } = Route.useParams()
  const search = Route.useSearch()
  const trail = findCategoryTrail(useSuspenseCategoryTree(), handle)
  // The tree refetched without it since the loader ran.
  if (!trail) throw notFound()

  const { category, ancestors } = trail
  return (
    <ProductListPage
      from={Route.fullPath}
      scope={scopeFor(handle)}
      search={search}
      heading={category.name}
      eyebrow={<CategoryBreadcrumb ancestors={ancestors} />}
      intro={<CategoryIntro category={category} />}
    />
  )
}

function CategoryNotFound() {
  return (
    <ProductListNotFound
      heading={<Trans>We couldn't find this category</Trans>}
      body={<Trans>It may have moved, or no longer be in the store.</Trans>}
    />
  )
}
