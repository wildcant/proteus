import { Link } from '@tanstack/react-router'
import { SEARCH_RESULTS_LIMIT } from '#/components/header/constants'
import { useProducts } from '#/features/products/api/products'
import { ProductGrid } from '#/features/products/components/product-grid'

/**
 * What fills the panel before the shopper has typed anything.
 *
 * TODO(product-groups): these are the first published products the list endpoint returns, not
 * best sellers. Ranking by units sold needs an aggregate over `order_line_item` that does not
 * exist, and a curated product group is the likelier shape for this slot anyway — the reference
 * runs a merchandised row here, not a computed one. The heading is aspirational until one of
 * those lands. See `.scratch/store-design-system/issues/03-header.md`.
 */
export function SearchBestSellers() {
  const { products } = useProducts({ limit: SEARCH_RESULTS_LIMIT })

  if (!products?.length) return null

  return (
    <section>
      {/* The link sits beside the heading here, not below the grid the way the search results
          put theirs — this row is a shortcut into the catalogue, not the tail of a result set. */}
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="type-heading m-0 text-ink">Best sellers</h2>
        <Link to="/" className="shrink-0 font-medium text-ink text-sm underline">
          View all
        </Link>
      </div>

      <ProductGrid products={products} className="mt-6" />
    </section>
  )
}
