import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import { PRODUCT_SORT_NAMES, productsListQueryOptions, productsPageQuery } from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListHeader } from '#/features/products/components/product-list-header'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'

/**
 * Everything that describes what the shopper is looking at: the term, the order and the page.
 * All three are optional and none is written when it holds its default, so `/` and `/?q=tee`
 * stay exactly those strings.
 */
const productsSearchSchema = z.object({
  // `.catch` so a stray `?q=` degrades to the unfiltered list instead of erroring the route.
  q: z.string().trim().min(1).optional().catch(undefined),
  // A friendly enum rather than the API's `order` string: an unrecognised column is not a 400,
  // it is silently an unordered list, and an enum makes that unrepresentable.
  sort: z.enum(PRODUCT_SORT_NAMES).optional().catch(undefined),
  offset: z.coerce.number().int().min(0).optional().catch(undefined),
})

export const Route = createFileRoute('/_main/')({
  ssr: true,
  validateSearch: productsSearchSchema,
  component: ProductsPage,
  // All three, because a param the loader does not see is a param the server renders the wrong
  // value for — a cold hit on `?offset=24` would otherwise be SSR'd as page 1.
  loaderDeps: ({ search }) => ({ q: search.q, sort: search.sort, offset: search.offset }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(productsListQueryOptions(productsPageQuery(deps)))
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      {/* Outside the boundary: none of it needs the query, so paging and sorting never blank the
          heading or the control that caused them. */}
      <ProductListHeader />

      <div className="mt-6">
        <Suspense fallback={<ProductListSkeleton />}>
          <ProductList />
        </Suspense>
      </div>
    </main>
  )
}
