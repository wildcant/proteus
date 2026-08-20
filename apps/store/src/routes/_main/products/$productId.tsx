import { formatPrice } from '@proteus/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { PackageIcon } from 'lucide-react'
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
      <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-3/4 animate-pulse bg-(--bg-subtle)" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-(--bg-subtle)" />
            <div className="h-5 w-1/4 animate-pulse rounded bg-(--bg-subtle)" />
          </div>
        </div>
      </main>
    )
  }

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <p className="text-(--foreground-muted) text-sm">Product not found.</p>
      </main>
    )
  }

  const firstVariant = product.variants[0]

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <nav className="mb-8 text-(--foreground-muted) text-sm">
        <Link to="/products" className="hover:text-foreground">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-3/4 overflow-hidden bg-(--bg-subtle)">
          {product.thumbnail ? (
            <img src={product.thumbnail} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-border">
              <PackageIcon className="h-16 w-16" />
            </div>
          )}
        </div>

        <div>
          <h1 className="font-medium text-2xl text-foreground">{product.title}</h1>

          {!!firstVariant && (
            <p className="mt-2 font-semibold text-foreground text-lg">
              {formatPrice(firstVariant.calculatedPrice.calculatedAmount, firstVariant.calculatedPrice.currencyCode)}
            </p>
          )}

          {!!product.description && (
            <p className="mt-4 text-(--foreground-muted) text-sm leading-relaxed">{product.description}</p>
          )}

          <AddToCart product={product} />
        </div>
      </div>
    </main>
  )
}
