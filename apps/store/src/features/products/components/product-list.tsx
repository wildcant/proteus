import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Pagination } from '#/components/pagination'
import { PRODUCTS_DEFAULT_LIMIT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useMarket } from '#/hooks/use-market'
import { ProductEmpty } from './product-empty'
import { ProductGrid } from './product-grid'

type ProductListProps = ProductListView & {
  /** Where an empty, unsearched list sends the shopper. The home page has nowhere wider to send them. */
  emptyLink?: ReactNode
}

export function ProductList({ scope, search, onSearchChange, emptyLink }: ProductListProps) {
  const { q, offset } = search
  const { current } = useMarket()
  const { products, count } = useSuspenseProducts(productsPageQuery({ ...search, scope, countryCode: current.iso2 }))

  /**
   * Paging no longer suspends: `offset` is a loader dep, so the loader has already awaited the
   * next page by the time the navigation commits and the grid simply keeps showing the previous
   * one. Without this the Next button looks broken on a slow connection.
   */
  const isNavigating = useRouterState({ select: (state) => state.isLoading })

  if (products.length === 0) return <ProductEmpty q={q} link={emptyLink} />

  return (
    <>
      <div aria-busy={isNavigating} className={isNavigating ? 'opacity-60 transition-opacity' : undefined}>
        <ProductGrid products={products} />
      </div>

      <Pagination
        offset={offset ?? 0}
        limit={PRODUCTS_DEFAULT_LIMIT}
        count={count}
        // Page 1 is written as `undefined`, not `offset=0`, so the default stays out of the URL
        // the way `sort`'s does.
        onOffsetChange={(next) => onSearchChange({ offset: next || undefined })}
        className="mt-12"
      />
    </>
  )
}
