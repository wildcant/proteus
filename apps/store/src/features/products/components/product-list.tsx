import { useState } from 'react'
import { useProducts } from '#/features/products/api/products'
import { ProductCard } from './product-card'

function ProductListSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
        <div key={index}>
          <div className="aspect-3/4 animate-pulse bg-(--bg-subtle)" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-(--bg-subtle)" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-(--bg-subtle)" />
        </div>
      ))}
    </div>
  )
}

export function ProductList() {
  const [offset, setOffset] = useState(0)
  const limit = 12
  const { products, count, isLoading } = useProducts({ offset, limit })

  if (isLoading) {
    return <ProductListSkeleton count={limit} />
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
        {products?.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {(!products || products.length === 0) && (
        <p className="py-20 text-center text-(--foreground-muted) text-sm">No products found.</p>
      )}

      {count != null && count > limit && (
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
