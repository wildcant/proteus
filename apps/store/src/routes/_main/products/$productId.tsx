import { formatPrice } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AddToCart } from '#/features/cart/components/add-to-cart'
import { productQueryOptions, useProduct } from '#/features/products/api/products'

export const Route = createFileRoute('/_main/products/$productId')({
  component: ProductDetailPage,
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productQueryOptions(params.productId)),
})

function ProductDetailPage() {
  const { productId } = Route.useParams()
  const { product, isLoading } = useProduct(productId)

  if (isLoading) {
    return (
      <main className="page-wrap px-4 pb-8 pt-14">
        <p className="text-[var(--sea-ink-soft)]">Loading...</p>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="page-wrap px-4 pb-8 pt-14">
        <p className="text-[var(--sea-ink-soft)]">Product not found.</p>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <Link to="/products" className="mb-4 inline-block text-sm text-[var(--sea-ink-soft)] hover:underline">
          &larr; Back to products
        </Link>

        <h1 className="display-title mb-2 text-4xl font-bold tracking-tight text-[var(--sea-ink)]">{product.title}</h1>

        {product.description && <p className="mb-8 text-[var(--sea-ink-soft)]">{product.description}</p>}

        {product.variants.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-[var(--sea-ink)]">Variants</h2>
            {product.variants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--card-bg)] px-4 py-3"
              >
                <span className="font-medium text-[var(--sea-ink)]">{variant.title}</span>
                <span className="font-semibold text-[var(--sea-ink)]">
                  {formatPrice(variant.calculatedPrice.originalAmount, variant.calculatedPrice.currencyCode)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--sea-ink-soft)]">No variants available.</p>
        )}

        <AddToCart product={product} />
      </section>
    </main>
  )
}
