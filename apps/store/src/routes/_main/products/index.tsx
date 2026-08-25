import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { z } from 'zod'
import {
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_DEFAULT_OFFSET,
  productsListQueryOptions,
} from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'

/** What the header's search field submits. Keeps a search result shareable. */
const productsSearchSchema = z.object({
  // `.catch` so a stray `?q=` degrades to the unfiltered list instead of erroring the route.
  q: z.string().trim().min(1).optional().catch(undefined),
})

export const Route = createFileRoute('/_main/products/')({
  ssr: true,
  validateSearch: productsSearchSchema,
  component: ProductsPage,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ context, deps }) => {
    await context.queryClient.ensureQueryData(
      productsListQueryOptions({ offset: PRODUCTS_DEFAULT_OFFSET, limit: PRODUCTS_DEFAULT_LIMIT, q: deps.q }),
    )
  },
  headers: () => ({
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function ProductsPage() {
  const { q } = Route.useSearch()

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Suspense fallback={<ProductListSkeleton />}>
        {/* Pagination is local state inside the list, so remounting on a new term is what
            resets it to page 1 — no effect watching `q`. */}
        <ProductList key={q} q={q} />
      </Suspense>
    </main>
  )
}
