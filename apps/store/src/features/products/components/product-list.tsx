import { useState } from 'react'
import { PRODUCTS_DEFAULT_LIMIT, PRODUCTS_DEFAULT_OFFSET, useSuspenseProducts } from '#/features/products/api/products'
import { ProductCard } from './product-card'

export function ProductList() {
  const [offset, setOffset] = useState(PRODUCTS_DEFAULT_OFFSET)
  const limit = PRODUCTS_DEFAULT_LIMIT
  const { products, count } = useSuspenseProducts({ offset, limit })

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {products.length === 0 && (
        <p className="py-20 text-center text-(--foreground-muted) text-sm">No products found.</p>
      )}

      {count > limit && (
        <div className="mt-12 flex items-center justify-center gap-6 text-(--foreground-muted) text-sm">
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <span>
            {Math.floor(offset / limit) + 1} / {Math.ceil(count / limit)}
          </span>
          <button
            type="button"
            className="hover:text-foreground disabled:opacity-40"
            disabled={offset + limit >= count}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}
