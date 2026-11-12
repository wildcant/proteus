import { Plural, useLingui } from '@lingui/react/macro'
import { type ReactNode, Suspense } from 'react'
import { PRODUCT_SORT_DEFAULT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useMarket } from '#/hooks/use-market'
import { ProductFilters } from './product-filters'
import { ProductSort } from './product-sort'
import { ProductTagFilter } from './product-tag-filter'

type ProductListHeaderProps = ProductListView & {
  /** The title while nothing is searched; a search term takes its place. */
  heading: ReactNode
  /** Replaces the "Shop" line above the title while nothing is searched — a category's breadcrumb. */
  eyebrow?: ReactNode
  /** Whatever the page shows between its title and the bar — a category's description and chips. */
  children?: ReactNode
}

/**
 * Everything on the page above the grid: the eyebrow, the title, the Tag chips, the filters and
 * the bar. It renders
 * outside the grid's `<Suspense>` boundary — `orders-panel.tsx` sets that split, and it matters
 * twice over here, because a sort control that vanishes while the sort you just picked is loading
 * is the worst possible moment for it to go.
 *
 * The result count, the chips and the filters are the things here that need a query, so each
 * suspends on its own.
 */
export function ProductListHeader({
  scope,
  search,
  onSearchChange,
  heading,
  eyebrow,
  children,
}: ProductListHeaderProps) {
  const { t } = useLingui()
  const { q, sort } = search

  return (
    <div>
      {!q && eyebrow ? eyebrow : <p className="text-ink-muted text-sm">{q ? t`Search` : t`Shop`}</p>}
      {/* Written inline rather than extracted: `account-detail.tsx` is the only other callsite,
          and the third is what would make a `PageHeading` worth having. */}
      <h1 className="type-display mt-2 text-ink">{q ?? heading}</h1>
      {children}
      {/* Its own boundary, so a slow answer leaves the title and the bar in place. */}
      <Suspense fallback={null}>
        <ProductTagFilter scope={scope} search={search} onSearchChange={onSearchChange} />
      </Suspense>
      <Suspense fallback={null}>
        <ProductFilters scope={scope} search={search} onSearchChange={onSearchChange} />
      </Suspense>

      {/* Sticky at every width, not just on a phone: the reference only needs a rail above `lg`
          because it has ten filter groups to put there. `top-14`/`lg:top-20` is the header's own
          height, and `z-40` sits under the header's `z-50`. */}
      <div className="sticky top-14 z-40 mt-6 flex items-center justify-between border-line border-y bg-surface lg:top-20">
        <Suspense fallback={<div className="h-4 w-24 animate-pulse bg-surface-subtle" />}>
          <ResultCount scope={scope} search={search} />
        </Suspense>
        <ProductSort
          value={sort ?? PRODUCT_SORT_DEFAULT}
          onChange={(next) =>
            onSearchChange({
              // The default stays absent from the URL, so `/` remains that exact string.
              sort: next === PRODUCT_SORT_DEFAULT ? undefined : next,
              // A shopper on page 5 of one order has no page 5 in mind in another.
              offset: undefined,
            })
          }
        />
      </div>
    </div>
  )
}

function ResultCount({ scope, search }: Pick<ProductListView, 'scope' | 'search'>) {
  const { current } = useMarket()
  const { count } = useSuspenseProducts(productsPageQuery({ ...search, scope, countryCode: current.iso2 }))

  return (
    <p className="text-ink-muted text-sm">
      <Plural value={count} one="# Product" other="# Products" />
    </p>
  )
}
