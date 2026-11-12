import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import { SEARCH_RESULTS_LIMIT } from '#/components/header/constants'
import { useProducts } from '#/features/products/api/products'
import { ProductGrid } from '#/features/products/components/product-grid/product-grid'
import {
  searchBestSellers,
  searchBestSellersGrid,
  searchBestSellersHeader,
  searchBestSellersTitle,
  searchBestSellersViewAll,
} from '#/features/products/components/search-best-sellers/search-best-sellers.variants'
import type { SearchLinks } from '#/features/products/types/links'
import { useMarket } from '#/hooks/use-market'

/**
 * What fills the panel before the shopper has typed anything.
 *
 * TODO(product-groups): these are the first published products the list endpoint returns, not
 * best sellers. Ranking by units sold needs an aggregate over `order_line_item` that does not
 * exist, and a curated product group is the likelier shape for this slot anyway — the reference
 * runs a merchandised row here, not a computed one. The heading is aspirational until one of
 * those lands. See `.scratch/store-design-system/issues/03-header.md`.
 */
export function SearchBestSellers({ links }: { links: Pick<SearchLinks, 'product' | 'bestSellers'> }) {
  const { current } = useMarket()
  // The row shows prices, so it is a priced request like any other and carries the market.
  const { products } = useProducts({ limit: SEARCH_RESULTS_LIMIT, countryCode: current.iso2 })

  if (!products?.length) return null

  return (
    <section className={searchBestSellers()}>
      {/* The link sits beside the heading here, not below the grid the way the search results
          put theirs — this row is a shortcut into the catalogue, not the tail of a result set. */}
      <div className={searchBestSellersHeader()}>
        <h2 className={cn(searchBestSellersTitle(), 'm-0')}>
          <Trans>Best sellers</Trans>
        </h2>
        <Link {...links.bestSellers} className={cn(searchBestSellersViewAll(), 'shrink-0')}>
          <Trans>View all</Trans>
        </Link>
      </div>

      <ProductGrid products={products} productLink={links.product} className={searchBestSellersGrid()} />
    </section>
  )
}
