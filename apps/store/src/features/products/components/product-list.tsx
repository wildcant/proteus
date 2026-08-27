import { getRouteApi, useRouterState } from '@tanstack/react-router'
import { Pagination } from '#/components/pagination'
import { PRODUCTS_DEFAULT_LIMIT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import { ProductEmpty } from './product-empty'
import { ProductGrid } from './product-grid'

const route = getRouteApi('/_main/')

export function ProductList() {
  const { q, sort, offset } = route.useSearch()
  const navigate = route.useNavigate()
  const { products, count } = useSuspenseProducts(productsPageQuery({ q, sort, offset }))

  /**
   * Paging no longer suspends: `offset` is a loader dep, so the loader has already awaited the
   * next page by the time the navigation commits and the grid simply keeps showing the previous
   * one. Without this the Next button looks broken on a slow connection.
   */
  const isNavigating = useRouterState({ select: (state) => state.isLoading })

  if (products.length === 0) return <ProductEmpty q={q} />

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
        onOffsetChange={(next) => navigate({ search: (previous) => ({ ...previous, offset: next || undefined }) })}
        className="mt-12"
      />
    </>
  )
}
