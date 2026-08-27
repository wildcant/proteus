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
        <p className="text-ink-muted">Product not found.</p>
      </main>
    )
  }

  // An unknown id in the URL falls back to the first variant rather than erroring.
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0]

  // A variant shows its own photos; products whose variants carry no links keep the full gallery.
  const variantImages = product.images.filter((image) => selectedVariant?.imageIds.includes(image.id))
  const images = variantImages.length > 0 ? variantImages : product.images

  return (
    // `pb-28` clears the action bar pinned over the bottom of the phone viewport; at `lg` the bar
    // is back inside the panel and the page only needs its own bottom margin.
    <main className="mx-auto w-full max-w-350 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-24">
      {/* The reference has no breadcrumb because it has a mega-nav to go back to. `/products` is
          our only listing, so this is the only way back from a PDP reached by search or by link. */}
      <nav className="mb-6 text-ink-muted text-xs">
        <Link to="/products" className="hover:text-ink">
          Products
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{product.title}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25.625rem] lg:gap-38">
        {/* Full-bleed below `lg`: a snap carousel that stops short of the edge snaps to a position
            that reads as a mistake. Margins matched to the gutter rather than a `100vw` trick,
            because `body { overflow-x: hidden }` would mask an overflow rather than prevent it. */}
        <div className="-mx-4 sm:-mx-6 lg:mx-0">
          <ProductGallery
            images={images}
            thumbnail={selectedVariant?.thumbnail ?? product.thumbnail}
            alt={product.title}
            variantId={selectedVariant?.id}
          />
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <div>
            {!!product.subtitle && <p className="mb-2 text-ink-subtle text-xs">{product.subtitle}</p>}
            <h1 className="type-title text-ink">{product.title}</h1>
            {!!selectedVariant && (
              <p className="mt-3 font-bold tabular-nums">
                {formatPrice(
                  selectedVariant.calculatedPrice.calculatedAmount,
                  selectedVariant.calculatedPrice.currencyCode,
                )}
              </p>
            )}
          </div>

          {/* Above the pickers, where the reference puts its teaser — and in full, because one
              `text` column does both jobs. It does not push Add to cart off a phone screen: below
              `lg` that button is pinned to the viewport, not to this column. */}
          {!!product.description && <p className="max-w-prose">{product.description}</p>}

          {/* Colour before size, and that is the option rank talking, not this component: the
              seed links Color first, which is also what makes the cart line read "Green · M". */}
          <VariantPicker
            options={product.options}
            variants={product.variants}
            pickerTargets={product.pickerTargets}
            selectedVariant={selectedVariant}
            // Replace so browsing colourways doesn't bury the previous page in history, and no
            // scroll reset: `scrollRestoration: true` (router.tsx) otherwise restores every scroller
            // it has tracked — including the gallery, matched by a structural selector the remount
            // does not escape — which put the new colourway on the old slide index.
            onVariantChange={(id) => navigate({ search: { variant: id }, replace: true, resetScroll: false })}
          />

          <AddToCart product={product} selectedVariant={selectedVariant} />

          <ProductSpecs product={product} variant={selectedVariant} />
        </div>
      </div>
    </main>
  )
}
