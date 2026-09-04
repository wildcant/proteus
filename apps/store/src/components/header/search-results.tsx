import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { SEARCH_DEBOUNCE_MS, SEARCH_RESULTS_LIMIT } from '#/components/header/constants'
import { SearchBestSellers } from '#/components/header/search-best-sellers'
import { useProducts } from '#/features/products/api/products'
import { ProductGrid } from '#/features/products/components/product-grid'
import { useDebounce } from '#/hooks/use-debounce'
import { useMarket } from '#/lib/use-market'

type SearchResultsProps = {
  /** The live field value. Debounced here rather than by the caller, so the field stays responsive. */
  term: string
}

/**
 * What the panel shows: matches once there is a term, and a merchandised row before that.
 *
 * The reference also runs a `TRENDING SEARCHES` column beside both, which has no source — `q`
 * goes into `buildSearchFilter` and is never recorded anywhere.
 */
export function SearchResults({ term }: SearchResultsProps) {
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

  if (!debouncedTerm) return <SearchBestSellers />

  // Undefined only on the very first search of the session; every later term keeps the previous
  // results on screen via keepPreviousData rather than falling back to this.
  if (!products) return null

  if (products.length === 0) {
    return (
      <p className="m-0 py-10 text-center text-ink-muted text-sm">No products match &ldquo;{debouncedTerm}&rdquo;.</p>
    )
  }

  return (
    <section>
      <h2 className="type-heading m-0 text-ink">Products</h2>

      <ProductGrid products={products} className="mt-6" />

      {/* The panel is a preview; the PLP is where the full result set lives. */}
      <div className="mt-8 flex justify-end border-line border-t pt-6">
        <Link to="/" search={{ q: debouncedTerm }} className="font-medium text-ink text-sm underline">
          View all &ldquo;{debouncedTerm}&rdquo;
        </Link>
      </div>
    </section>
  )
}
