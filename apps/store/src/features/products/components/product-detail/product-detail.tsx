import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useSuspenseProduct } from '#/features/products/api/products'
import { AddToCart } from '#/features/products/components/add-to-cart/add-to-cart'
import {
  productDetail,
  productDetailAddToCart,
  productDetailBody,
  productDetailBreadcrumb,
  productDetailCurrent,
  productDetailDescription,
  productDetailGallery,
  productDetailHeading,
  productDetailInfo,
  productDetailPicker,
  productDetailPrice,
  productDetailProductsLink,
  productDetailSeparator,
  productDetailSpecs,
  productDetailTitle,
} from '#/features/products/components/product-detail/product-detail.variants'
import { ProductError } from '#/features/products/components/product-error/product-error'
import { ProductGallery } from '#/features/products/components/product-gallery/product-gallery'
import { ProductSpecs } from '#/features/products/components/product-specs/product-specs'
import { VariantPicker } from '#/features/products/components/variant-picker/variant-picker'
import { VariantStock } from '#/features/products/components/variant-stock/variant-stock'
import { useFormatters } from '#/hooks/use-formatters'
import { useMarket } from '#/hooks/use-market'

const route = getRouteApi('/_main/products/$productId')

export function ProductDetail() {
  const { productId } = route.useParams()
  const { variant: variantId } = route.useSearch()
  const navigate = route.useNavigate()
  const { current } = useMarket()
  const { formatPrice } = useFormatters()
  const { product } = useSuspenseProduct(productId, { countryCode: current.iso2 })

  // The market has no product under this id — either none exists or none of its variants have a
  // price here. Both arrive as the API's one not-found, and both read the same to the shopper.
  if (!product) return <ProductError />

  // An unknown id in the URL falls back to the first variant rather than erroring.
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0]

  // A variant shows its own photos; products whose variants carry no links keep the full gallery.
  const variantImages = product.images.filter((image) => selectedVariant?.imageIds.includes(image.id))
  const images = variantImages.length > 0 ? variantImages : product.images

  return (
    // `pb-28` clears the action bar pinned over the bottom of the phone viewport; at `lg` the bar
    // is back inside the panel and the page only needs its own bottom margin. `mx-auto w-full`
    // centres the capped page, which the design file draws as stretched.
    <main className={cn(productDetail(), 'mx-auto w-full')}>
      {/* The reference has no breadcrumb because it has a mega-nav to go back to. `/` is
          our only listing, so this is the only way back from a PDP reached by search or by link. */}
      <nav className={productDetailBreadcrumb()}>
        <Link to="/" className={productDetailProductsLink()}>
          <Trans>Products</Trans>
        </Link>
        <span className={productDetailSeparator()}>/</span>
        <span className={productDetailCurrent()}>{product.title}</span>
      </nav>

      <div className={productDetailBody()}>
        {/* Full-bleed below `lg`: a snap carousel that stops short of the edge snaps to a position
            that reads as a mistake. Margins matched to the gutter rather than a `100vw` trick,
            because `body { overflow-x: hidden }` would mask an overflow rather than prevent it. */}
        <div className={cn(productDetailGallery(), '-mx-4 min-w-0 sm:-mx-6 lg:mx-0')}>
          <ProductGallery
            images={images}
            thumbnail={selectedVariant?.thumbnail ?? product.thumbnail}
            alt={product.title}
            variantId={selectedVariant?.id}
            className="w-full"
          />
        </div>

        <div className={cn(productDetailInfo(), 'shrink-0 lg:sticky lg:top-24 lg:self-start')}>
          <div className={productDetailHeading()}>
            {/* The fit line is not drawn yet (no seeded product has one), so it groups with the
                title and keeps its own 8px. */}
            <div className="self-stretch">
              {!!product.subtitle && <p className="mb-2 text-ink-subtle text-xs">{product.subtitle}</p>}
              <h1 className={productDetailTitle()}>{product.title}</h1>
            </div>
            {!!selectedVariant && (
              // Under the price and above the picker: the stock line is an answer about the variant
              // the shopper is currently on, so it belongs beside the other one — and ahead of the
              // control that changes which variant that is. Not drawn in the heading, so it keeps
              // its own 8px under the price.
              <div>
                <p className={cn(productDetailPrice(), 'tabular-nums')}>
                  {formatPrice(
                    selectedVariant.calculatedPrice.calculatedAmount,
                    selectedVariant.calculatedPrice.currencyCode,
                  )}
                </p>
                <VariantStock stock={selectedVariant.stock} className="mt-2" />
              </div>
            )}
          </div>

          {/* Above the pickers, where the reference puts its teaser — and in full, because one
              `text` column does both jobs. It does not push Add to cart off a phone screen: below
              `lg` that button is pinned to the viewport, not to this column. */}
          {!!product.description && (
            <p className={cn(productDetailDescription(), 'max-w-prose')}>{product.description}</p>
          )}

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
            className={productDetailPicker()}
          />

          <AddToCart product={product} selectedVariant={selectedVariant} className={productDetailAddToCart()} />

          <ProductSpecs product={product} variant={selectedVariant} className={productDetailSpecs()} />
        </div>
      </div>
    </main>
  )
}
