import { cn } from '@proteus/ui-core'
import { useRouterState } from '@tanstack/react-router'
import { Pagination } from '#/components/store/pagination/pagination'
import { PRODUCTS_DEFAULT_LIMIT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import { ProductEmpty } from '#/features/products/components/product-empty/product-empty'
import { ProductGrid } from '#/features/products/components/product-grid/product-grid'
import {
  productList,
  productListGrid,
  productListPagination,
  productListResults,
} from '#/features/products/components/product-list/product-list.variants'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useMarket } from '#/hooks/use-market'

export function ProductList({ scope, search, onSearchChange, className }: ProductListView & { className?: string }) {
  const { offset } = search
  const { current } = useMarket()
  const { products, count } = useSuspenseProducts(productsPageQuery({ ...search, scope, countryCode: current.iso2 }))

  /**
   * Paging no longer suspends: `offset` is a loader dep, so the loader has already awaited the
   * next page by the time the navigation commits and the grid simply keeps showing the previous
   * one. Without this the Next button looks broken on a slow connection.
   */
  const isNavigating = useRouterState({ select: (state) => state.isLoading })

  // A scope is what makes a list narrower than the whole catalogue, and so what gives "Shop all"
  // somewhere wider to go. The home page's is empty.
  if (products.length === 0) {
    return <ProductEmpty search={search} isScoped={Object.keys(scope).length > 0} className={className} />
  }

  return (
    <div className={cn(productList(), className)}>
      <div
        aria-busy={isNavigating}
        className={cn(productListResults({ navigating: isNavigating }), isNavigating && 'transition-opacity')}
      >
        <ProductGrid products={products} className={productListGrid()} />
      </div>

      <Pagination
        offset={offset ?? 0}
        limit={PRODUCTS_DEFAULT_LIMIT}
        count={count}
        // Page 1 is written as `undefined`, not `offset=0`, so the default stays out of the URL
        // the way `sort`'s does.
        onOffsetChange={(next) => onSearchChange({ offset: next || undefined })}
        className={productListPagination()}
      />
    </div>
  )
}
