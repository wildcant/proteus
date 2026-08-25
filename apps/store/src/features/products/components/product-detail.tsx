import { formatPrice } from '@proteus/ui'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useSuspenseProduct } from '#/features/products/api/products'
import { AddToCart } from '#/features/products/components/add-to-cart'
import { ProductGallery } from '#/features/products/components/product-gallery'
import { ProductSpecs } from '#/features/products/components/product-specs'
import { VariantPicker } from '#/features/products/components/variant-picker'

const route = getRouteApi('/_main/products/$productId')

export function ProductDetail() {
  const { productId } = route.useParams()
  const { variant: variantId } = route.useSearch()
  const navigate = route.useNavigate()
  const { product } = useSuspenseProduct(productId)

  if (!product) {
    return (
      <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        <p className="text-(--foreground-muted) text-sm">Product not found.</p>
      </main>
    )
  }

  // An unknown id in the URL falls back to the first variant rather than erroring.
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0]

  // A variant shows its own photos; products whose variants carry no links keep the full gallery.
  const variantImages = product.images.filter((image) => selectedVariant?.imageIds.includes(image.id))
  const images = variantImages.length > 0 ? variantImages : product.images

  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <nav className="mb-8 text-(--foreground-muted) text-xs uppercase tracking-[0.18em]">
        <Link to="/products" className="hover:text-foreground">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <ProductGallery
          images={images}
          thumbnail={selectedVariant?.thumbnail ?? product.thumbnail}
          alt={product.title}
        />

        <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:max-w-md lg:self-start">
          <div>
            {!!product.subtitle && (
              <p className="mb-3 text-(--foreground-muted) text-xs uppercase tracking-[0.18em]">{product.subtitle}</p>
            )}
            <h1 className="font-extralight text-4xl text-foreground leading-none tracking-tight sm:text-5xl">
              {product.title}
            </h1>
            {!!selectedVariant && (
              <p className="mt-4 text-foreground text-lg tabular-nums">
                {formatPrice(
                  selectedVariant.calculatedPrice.calculatedAmount,
                  selectedVariant.calculatedPrice.currencyCode,
                )}
              </p>
            )}
          </div>

          <VariantPicker
            options={product.options}
            variants={product.variants}
            pickerTargets={product.pickerTargets}
            selectedVariant={selectedVariant}
            // Replace so browsing colourways doesn't bury the previous page in history.
            onVariantChange={(id) => navigate({ search: { variant: id }, replace: true })}
          />

          <AddToCart product={product} selectedVariant={selectedVariant} />

          {!!product.description && (
            <p className="max-w-prose text-(--foreground-muted) text-sm leading-relaxed">{product.description}</p>
          )}

          <ProductSpecs product={product} variant={selectedVariant} />
        </div>
      </div>
    </main>
  )
}
