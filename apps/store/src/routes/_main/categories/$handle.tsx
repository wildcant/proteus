import { Trans } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { categoryTreeQueryOptions, findCategoryTrail, useSuspenseCategoryTree } from '#/api/product-categories'
import { ButtonLink } from '#/components/button'
import { type ProductListScope, productsListQueryOptions, productsPageQuery } from '#/features/products/api/products'
import { CategoryBreadcrumb } from '#/features/products/components/category-breadcrumb'
import { CategoryIntro } from '#/features/products/components/category-intro'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListHeader } from '#/features/products/components/product-list-header'
import { ProductListNotFound } from '#/features/products/components/product-list-not-found'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'
import { type ProductListView, productListSearchSchema } from '#/features/products/utils/product-list-search'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

/** The list is scoped by handle; the backend widens it to the Category's Visible descendants. */
const scopeFor = (handle: string): ProductListScope => ({ category: handle })

export const Route = createFileRoute('/_main/categories/$handle')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  validateSearch: productListSearchSchema,
  component: CategoryPage,
  // See the home route: a param the loader does not see is one the server renders wrong.
  loaderDeps: ({ search }) => ({ q: search.q, sort: search.sort, offset: search.offset }),
  loader: async ({ context, deps, params }) => {
    // The `_main` loader is fetching the tree alongside this one, so this joins its request rather
    // than making a second: the Category, its ancestors and its children all come from there.
    const tree = await context.queryClient.ensureQueryData(categoryTreeQueryOptions())
    // A handle the Visible tree does not hold renders the not-found state, with no list to load.
    if (!findCategoryTrail(tree, params.handle)) return
    const query = productsPageQuery({
      ...deps,
      scope: scopeFor(params.handle),
      countryCode: context.market.current.iso2,
    })
    await context.queryClient.ensureQueryData(productsListQueryOptions(query))
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function CategoryPage() {
  const { handle } = Route.useParams()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const trail = findCategoryTrail(useSuspenseCategoryTree(), handle)

  if (!trail) {
    return (
      <ProductListNotFound
        heading={<Trans>We couldn't find this category</Trans>}
        body={<Trans>It may have moved, or no longer be in the store.</Trans>}
      />
    )
  }

  const { category, ancestors } = trail
  const list: ProductListView = {
    scope: scopeFor(handle),
    search,
    onSearchChange: (update) => navigate({ search: (previous) => ({ ...previous, ...update }) }),
  }

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <ProductListHeader {...list} heading={category.name} eyebrow={<CategoryBreadcrumb ancestors={ancestors} />}>
        {search.q ? null : <CategoryIntro category={category} />}
      </ProductListHeader>

      <div className="mt-6">
        <Suspense fallback={<ProductListSkeleton />}>
          <ProductList
            {...list}
            emptyLink={
              <ButtonLink to="/">
                <Trans>Shop all</Trans>
              </ButtonLink>
            }
          />
        </Suspense>
      </div>
    </main>
  )
}
