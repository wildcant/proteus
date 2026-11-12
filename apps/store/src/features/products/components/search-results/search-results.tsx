import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { SEARCH_DEBOUNCE_MS, SEARCH_RESULTS_LIMIT } from '#/components/header/constants'
import { useProducts } from '#/features/products/api/products'
import { ProductGrid } from '#/features/products/components/product-grid/product-grid'
import { SearchBestSellers } from '#/features/products/components/search-best-sellers/search-best-sellers'
import {
  searchResults,
  searchResultsFooter,
  searchResultsGrid,
  searchResultsMatches,
  searchResultsMessage,
  searchResultsTitle,
  searchResultsViewAll,
} from '#/features/products/components/search-results/search-results.variants'
import type { SearchLinks } from '#/features/products/types/links'
import { useDebounce } from '#/hooks/use-debounce'
import { useMarket } from '#/hooks/use-market'

type SearchResultsProps = {
  /** The live field value. Debounced here rather than by the caller, so the field stays responsive. */
  term: string
  links: Pick<SearchLinks, 'product' | 'viewAll' | 'bestSellers'>
}

/**
 * What the panel shows: matches once there is a term, and a merchandised row before that.
 *
 * The reference also runs a `TRENDING SEARCHES` column beside both, which has no source — `q`
 * goes into `buildSearchFilter` and is never recorded anywhere.
 */
export function SearchResults({ term, links }: SearchResultsProps) {
  const trimmed = term.trim()
  const [debouncedTerm, setDebouncedTerm] = useState('')
  const { current } = useMarket()

  // Clearing the field skips the delay: waiting 250ms to hide results the shopper just deleted
  // reads as lag, where waiting to *show* results reads as the query working.
  useDebounce(() => setDebouncedTerm(trimmed), trimmed ? SEARCH_DEBOUNCE_MS : 0, [trimmed])
  const { products } = useProducts(
    { q: debouncedTerm, limit: SEARCH_RESULTS_LIMIT, countryCode: current.iso2 },
    { enabled: debouncedTerm.length > 0 },
  )

  if (!debouncedTerm) return <SearchBestSellers links={links} />

  // Undefined only on the very first search of the session; every later term keeps the previous
  // results on screen via keepPreviousData rather than falling back to this.
  if (!products) return null

  if (products.length === 0) {
    return (
      <div className={searchResults({ state: 'empty' })}>
        <p className={cn(searchResultsMessage({ state: 'empty' }), 'm-0')}>
          <Trans>No products match &ldquo;{debouncedTerm}&rdquo;.</Trans>
        </p>
      </div>
    )
  }

  return (
    <section className={searchResults({ state: 'results' })}>
      <div className={searchResultsMatches({ state: 'results' })}>
        <h2 className={cn(searchResultsTitle(), 'm-0')}>
          <Trans>Products</Trans>
        </h2>

        <ProductGrid products={products} productLink={links.product} className={searchResultsGrid()} />
      </div>

      {/* The panel is a preview; the PLP is where the full result set lives. */}
      <div className={searchResultsFooter({ state: 'results' })}>
        <Link {...links.viewAll(debouncedTerm)} className={searchResultsViewAll()}>
          <Trans>View all &ldquo;{debouncedTerm}&rdquo;</Trans>
        </Link>
      </div>
    </section>
  )
}
