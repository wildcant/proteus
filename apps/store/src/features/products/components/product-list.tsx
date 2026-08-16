import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useProducts } from '#/features/products/api/products'

export function ProductList() {
  const [offset, setOffset] = useState(0)
  const limit = 20
  const { products, count, isLoading } = useProducts({ offset, limit })

  if (isLoading) {
    return <p className="text-[var(--sea-ink-soft)]">Loading products...</p>
  }

  return (
    <>
      <div className="space-y-2">
        {products?.map((product) => (
          <Link
            key={product.id}
            to="/products/$productId"
            params={{ productId: product.id }}
            className="block rounded-xl border border-[var(--line)] bg-[var(--card-bg)] px-4 py-3 transition-colors hover:border-[var(--sea-ink-soft)]"
          >
            <span className="font-medium text-[var(--sea-ink)]">{product.title}</span>
            {product.description && <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">{product.description}</p>}
          </Link>
        ))}
        {(!products || products.length === 0) && (
          <p className="text-center text-sm text-[var(--sea-ink-soft)]">No products found.</p>
        )}
      </div>

      {count != null && count > 0 && (
        <div className="mt-6 flex items-center justify-between text-sm text-[var(--sea-ink-soft)]">
          <span>
            Showing {offset + 1}–{Math.min(offset + limit, count)} of {count}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-3 py-1 disabled:opacity-50"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded-md border border-[var(--line)] px-3 py-1 disabled:opacity-50"
              disabled={offset + limit >= count}
              onClick={() => setOffset(offset + limit)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </>
  )
}
