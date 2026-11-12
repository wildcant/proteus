import { cn } from '@proteus/ui-core'
import { useNavigate } from '@tanstack/react-router'
import { type ReactNode, Suspense } from 'react'
import { ProductList } from '#/features/products/components/product-list/product-list'
import { ProductListHeader } from '#/features/products/components/product-list-header/product-list-header'
import {
  productListPage,
  productListPageHeader,
  productListPageList,
} from '#/features/products/components/product-list-page/product-list-page.variants'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton/product-list-skeleton'
import type { ProductListLinks } from '#/features/products/types/links'
import type { ProductListView } from '#/features/products/utils/product-list-search'

/** The routes that render a product list, which is what types the navigation back to them. */
type ProductListPath = '/' | '/categories/$handle' | '/collections/$handle'

type ProductListPageProps = Pick<ProductListView, 'scope' | 'search'> & {
  from: ProductListPath
  links: ProductListLinks
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
export function ProductListPage({ from, links, scope, search, heading, eyebrow, intro }: ProductListPageProps) {
  const navigate = useNavigate()
  const list: ProductListView = {
    scope,
    search,
    onSearchChange: (update) => navigate({ from, search: (previous) => ({ ...previous, ...update }) }),
  }

  // A search term replaces the heading, so what introduces the page steps aside with it.
  const shownIntro = search.q ? null : intro

  return (
    // `mx-auto w-full` centres the capped page, which the design file draws as stretched.
    <main className={cn(productListPage(), 'mx-auto w-full')}>
      {/* Outside the boundary: none of it needs the query, so paging and sorting never blank the
          heading or the control that caused them. */}
      <ProductListHeader {...list} heading={heading} eyebrow={eyebrow} className={productListPageHeader()}>
        {shownIntro}
      </ProductListHeader>

      <div className={productListPageList()}>
        <Suspense fallback={<ProductListSkeleton className="w-full" />}>
          <ProductList {...list} links={links} className="w-full" />
        </Suspense>
      </div>
    </main>
  )
}
