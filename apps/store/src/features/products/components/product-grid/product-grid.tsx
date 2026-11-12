import { cn } from '@proteus/ui-core'
import type { StoreProductListItem } from '#/api/generated/model'
import { ProductCard } from '#/features/products/components/product-card/product-card'
import { productGrid, productGridCard } from '#/features/products/components/product-grid/product-grid.variants'

type ProductGridProps = {
  products: StoreProductListItem[]
  className?: string
  /** How many cards get eager image loading. The PLP wants a row; a 4-up panel wants all of them. */
  priorityCount?: number
}

/**
 * The contact-sheet grid, on its own so the PLP and the search panel cannot drift apart on
 * column counts, gutters or card treatment. Two-up on phones at every callsite — the cards
 * are 4:5, and three across leaves them too small to judge a garment by.
 *
 * The near-zero column gutter is the whole effect: the images almost touch, so the page reads as
 * a sheet of photographs rather than a set of cards. The row gutter stays generous because that
 * is what keeps one card's price off the next card's title.
 */
export function ProductGrid({ products, className, priorityCount = 4 }: ProductGridProps) {
  return (
    <div className={cn(productGrid(), className)}>
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          priority={index < priorityCount}
          className={productGridCard()}
        />
      ))}
    </div>
  )
}
