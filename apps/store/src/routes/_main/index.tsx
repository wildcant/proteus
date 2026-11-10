import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { type ProductListScope, productsListQueryOptions, productsPageQuery } from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListHeader } from '#/features/products/components/product-list-header'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'
import { type ProductListView, productListSearchSchema } from '#/features/products/utils/product-list-search'
import { marketHeadLinksFor } from '#/lib/seo/market-links'

/** The home page is the whole catalogue: nothing narrows it. */
const HOME_SCOPE: ProductListScope = {}

export const Route = createFileRoute('/_main/')({
  ssr: true,
  head: (context) => ({ links: marketHeadLinksFor(context) }),
  validateSearch: productListSearchSchema,
  component: ProductsPage,
  // All three, because a param the loader does not see is a param the server renders the wrong
  // value for — a cold hit on `?offset=24` would otherwise be SSR'd as page 1.
  loaderDeps: ({ search }) => ({ q: search.q, sort: search.sort, offset: search.offset }),
  loader: async ({ context, deps }) => {
    // The market's country goes in with the rest of the page's parameters: it is what the backend
    // prices the response in, so a loader that left it out would SSR one market's catalogue at
    // another's currency and then swap it on hydration.
    const query = productsPageQuery({ ...deps, scope: HOME_SCOPE, countryCode: context.market.current.iso2 })
    await context.queryClient.ensureQueryData(productsListQueryOptions(query))
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function ProductsPage() {
  const { t } = useLingui()
  const navigate = Route.useNavigate()
  const list: ProductListView = {
    scope: HOME_SCOPE,
    search: Route.useSearch(),
    onSearchChange: (update) => navigate({ search: (previous) => ({ ...previous, ...update }) }),
  }

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      {/* Outside the boundary: none of it needs the query, so paging and sorting never blank the
          heading or the control that caused them. */}
      <ProductListHeader {...list} heading={t`All products`} />

      <div className="mt-6">
        <Suspense fallback={<ProductListSkeleton />}>
          {/* No empty-state link: the home page is already "Shop all". */}
          <ProductList {...list} />
        </Suspense>
      </div>
    </main>
  )
}
