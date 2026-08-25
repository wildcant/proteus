import { cn } from '@proteus/ui'
import type { StoreProductListItem } from '#/api/generated/model'
import { ProductCard } from './product-card'

type ProductGridProps = {
  products: StoreProductListItem[]
  className?: string
  /** How many cards get eager image loading. The PLP wants a row; a 4-up panel wants all of them. */
  priorityCount?: number
}

/**
 * The contact-sheet grid, on its own so the PLP and the search panel cannot drift apart on
 * column counts, gutters or card treatment. Two-up on phones at every callsite — the cards
 * are 3:4, and three across leaves them too small to judge a garment by.
 */
export function ProductGrid({ products, className, priorityCount = 4 }: ProductGridProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4', className)}>
      {products.map((product, index) => (
        <ProductCard key={product.id} product={product} priority={index < priorityCount} />
      ))}
    </div>
  )
}
