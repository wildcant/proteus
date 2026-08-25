import { useState } from 'react'
import { Pagination } from '#/components/pagination'
import { PRODUCTS_DEFAULT_LIMIT, PRODUCTS_DEFAULT_OFFSET, useSuspenseProducts } from '#/features/products/api/products'
import { ProductGrid } from './product-grid'

type ProductListProps = {
  /** The active search term. The route remounts this component when it changes. */
  q?: string
}

export function ProductList({ q }: ProductListProps) {
  const [offset, setOffset] = useState(PRODUCTS_DEFAULT_OFFSET)
  const limit = PRODUCTS_DEFAULT_LIMIT
  const { products, count } = useSuspenseProducts({ offset, limit, q })

  return (
    <>
      <ProductGrid products={products} />

      {products.length === 0 && <p className="py-20 text-center text-ink-muted text-sm">No products found.</p>}

      <Pagination offset={offset} limit={limit} count={count} onOffsetChange={setOffset} className="mt-12" />
    </>
  )
}
