import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, Suspense } from 'react'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { ProductList } from './product-list'
import { ProductListHeader } from './product-list-header'
import { ProductListSkeleton } from './product-list-skeleton'

/** The routes that render a product list, which is what types the navigation back to them. */
type ProductListPath = '/' | '/categories/$handle' | '/collections/$handle'

type ProductListPageProps = Pick<ProductListView, 'scope' | 'search'> & {
  from: ProductListPath
  heading: ReactNode
  /** See `ProductListHeader`: a category's breadcrumb. */
  eyebrow?: ReactNode
  /** Between the title and the bar while nothing is searched — a category's description, a collection's hero. */
  intro?: ReactNode
}

/**
 * A whole product list page: the header, then the grid in its own boundary. The route validates
 * `search` and hands it in, so the list reads this page's params and nothing else; a change is
 * written back to the same page, merged over what is there.
 */
export function ProductListPage({ from, scope, search, heading, eyebrow, intro }: ProductListPageProps) {
  const navigate = useNavigate()
  const list: ProductListView = {
    scope,
    search,
    onSearchChange: (update) => navigate({ from, search: (previous) => ({ ...previous, ...update }) }),
  }

  // A search term replaces the heading, so what introduces the page steps aside with it.
  const shownIntro = search.q ? null : intro

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      {/* Outside the boundary: none of it needs the query, so paging and sorting never blank the
          heading or the control that caused them. */}
      <ProductListHeader {...list} heading={heading} eyebrow={eyebrow}>
        {shownIntro}
      </ProductListHeader>

      <div className="mt-6">
        <Suspense fallback={<ProductListSkeleton />}>
          <ProductList {...list} />
        </Suspense>
      </div>
    </main>
  )
}
