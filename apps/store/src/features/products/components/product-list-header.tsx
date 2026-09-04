import { getRouteApi } from '@tanstack/react-router'
import { Suspense } from 'react'
import { PRODUCT_SORT_DEFAULT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import { useMarket } from '#/lib/use-market'
import { ProductSort } from './product-sort'

const route = getRouteApi('/_main/')

/**
 * Everything on the page that needs no data: the eyebrow, the title and the bar. It renders
 * outside the grid's `<Suspense>` boundary — `orders-panel.tsx` sets that split, and it matters
 * twice over here, because a sort control that vanishes while the sort you just picked is loading
 * is the worst possible moment for it to go.
 *
 * The result count is the one thing here that does need the query, so it suspends on its own.
 */
export function ProductListHeader() {
  const { q, sort } = route.useSearch()
  const navigate = route.useNavigate()

  return (
    <div>
      <p className="text-ink-muted text-sm">{q ? 'Search' : 'Shop'}</p>
      {/* Written inline rather than extracted: `account-detail.tsx` is the only other callsite,
          and the third is what would make a `PageHeading` worth having. */}
      <h1 className="type-display mt-2 text-ink">{q ?? 'All products'}</h1>

      {/* Sticky at every width, not just on a phone: the reference only needs a rail above `lg`
          because it has ten filter groups to put there. `top-14`/`lg:top-20` is the header's own
          height, and `z-40` sits under the header's `z-50`. */}
      <div className="sticky top-14 z-40 mt-6 flex items-center justify-between border-line border-y bg-surface lg:top-20">
        <Suspense fallback={<div className="h-4 w-24 animate-pulse bg-surface-subtle" />}>
          <ResultCount />
        </Suspense>
        <ProductSort
          value={sort ?? PRODUCT_SORT_DEFAULT}
          onChange={(next) =>
            navigate({
              search: (previous) => ({
                ...previous,
                // The default stays absent from the URL, so `/` remains that exact string.
                sort: next === PRODUCT_SORT_DEFAULT ? undefined : next,
                // A shopper on page 5 of one order has no page 5 in mind in another.
                offset: undefined,
              }),
            })
          }
        />
      </div>
    </div>
  )
}

function ResultCount() {
  const { q, sort, offset } = route.useSearch()
  const { current } = useMarket()
  const { count } = useSuspenseProducts(productsPageQuery({ q, sort, offset, countryCode: current.iso2 }))

  return (
    <p className="text-ink-muted text-sm">
      {count} {count === 1 ? 'Product' : 'Products'}
    </p>
  )
}
