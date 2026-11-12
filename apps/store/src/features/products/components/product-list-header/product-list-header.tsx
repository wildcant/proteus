import { Plural, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { type ReactNode, Suspense } from 'react'
import { PRODUCT_SORT_DEFAULT, productsPageQuery, useSuspenseProducts } from '#/features/products/api/products'
import { ProductFilters } from '#/features/products/components/product-filters/product-filters'
import {
  productListHeader,
  productListHeaderBar,
  productListHeaderEyebrow,
  productListHeaderFilters,
  productListHeaderIntro,
  productListHeaderResultCount,
  productListHeaderSort,
  productListHeaderTagFilter,
  productListHeaderTitle,
  productListHeaderTitleGroup,
  productListHeaderTop,
} from '#/features/products/components/product-list-header/product-list-header.variants'
import { ProductSort } from '#/features/products/components/product-sort/product-sort'
import { ProductTagFilter } from '#/features/products/components/product-tag-filter/product-tag-filter'
import type { ProductListView } from '#/features/products/utils/product-list-search'
import { useMarket } from '#/hooks/use-market'

type ProductListHeaderProps = ProductListView & {
  /** The title while nothing is searched; a search term takes its place. */
  heading: ReactNode
  /** Replaces the "Shop" line above the title while nothing is searched — a category's breadcrumb. */
  eyebrow?: ReactNode
  /** Whatever the page shows between its title and the bar — a category's description and chips. */
  children?: ReactNode
  className?: string
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
  className,
}: ProductListHeaderProps) {
  const { t } = useLingui()
  const { q, sort } = search

  return (
    <div className={cn(productListHeader(), className)}>
      <div className={productListHeaderTop()}>
        <div className={productListHeaderTitleGroup()}>
          {!q && eyebrow ? eyebrow : <p className={productListHeaderEyebrow()}>{q ? t`Search` : t`Shop`}</p>}
          {/* Written inline rather than extracted: `account-detail.tsx` is the only other callsite,
              and the third is what would make a `PageHeading` worth having. */}
          <h1 className={productListHeaderTitle()}>{q ?? heading}</h1>
        </div>
        {/* `empty:hidden`: an intro that renders nothing must not leave the slot's gap behind. */}
        <div className={cn(productListHeaderIntro(), 'empty:hidden')}>{children}</div>
      </div>
      {/* Its own boundary, so a slow answer leaves the title and the bar in place. */}
      <Suspense fallback={null}>
        <ProductTagFilter
          scope={scope}
          search={search}
          onSearchChange={onSearchChange}
          className={productListHeaderTagFilter()}
        />
      </Suspense>
      <Suspense fallback={null}>
        <ProductFilters
          scope={scope}
          search={search}
          onSearchChange={onSearchChange}
          className={productListHeaderFilters()}
        />
      </Suspense>

      {/* Sticky at every width, not just on a phone: the reference only needs a rail above `lg`
          because it has ten filter groups to put there. `top-14`/`lg:top-20` is the header's own
          height, and `z-40` sits under the header's `z-50`. */}
      <div className={cn(productListHeaderBar(), 'sticky top-14 z-40 lg:top-20')}>
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
          className={productListHeaderSort()}
        />
      </div>
    </div>
  )
}

function ResultCount({ scope, search }: Pick<ProductListView, 'scope' | 'search'>) {
  const { current } = useMarket()
  const { count } = useSuspenseProducts(productsPageQuery({ ...search, scope, countryCode: current.iso2 }))

  return (
    <p className={productListHeaderResultCount()}>
      <Plural value={count} one="# Product" other="# Products" />
    </p>
  )
}
