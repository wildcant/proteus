import { cn } from '@proteus/ui-core'
import {
  productDetailSkeleton,
  productDetailSkeletonButtonLine,
  productDetailSkeletonColour,
  productDetailSkeletonColourLine,
  productDetailSkeletonCrumbLine,
  productDetailSkeletonEyebrowLine,
  productDetailSkeletonGallery,
  productDetailSkeletonHeading,
  productDetailSkeletonInfo,
  productDetailSkeletonLayout,
  productDetailSkeletonMediaFirst,
  productDetailSkeletonMediaSecond,
  productDetailSkeletonMediaWide,
  productDetailSkeletonPriceLine,
  productDetailSkeletonSize,
  productDetailSkeletonSizeCell,
  productDetailSkeletonSizeLine,
  productDetailSkeletonSizes,
  productDetailSkeletonSwatch,
  productDetailSkeletonSwatches,
  productDetailSkeletonTitleLine,
} from '#/features/products/components/product-detail-skeleton/product-detail-skeleton.variants'

const PULSE = 'animate-pulse'

/**
 * The client-navigation shape. A direct hit is SSR'd with the product already in the markup, so
 * this only ever shows on a cold-cache navigation from the PLP — which is exactly why it has to
 * describe the layout that resolves in: one full-bleed 4:5 block below `lg`, the two-column mosaic
 * above it, and the 410px panel beside it.
 */
export function ProductDetailSkeleton() {
  return (
    <main className={cn(productDetailSkeleton(), 'mx-auto w-full max-w-350')}>
      <div className={cn(productDetailSkeletonCrumbLine(), PULSE)} />

      <div className={productDetailSkeletonLayout()}>
        {/* Full bleed below `lg`, as the product page's gallery: the drawing can't pull a layer
            into its parent's padding. */}
        <div className={cn(productDetailSkeletonGallery(), '-mx-4 min-w-0 sm:-mx-6 lg:mx-0')}>
          <div className={cn(productDetailSkeletonMediaFirst(), 'aspect-4/5', PULSE)} />
          <div className={cn(productDetailSkeletonMediaSecond(), 'aspect-4/5', PULSE)} />
          <div className={cn(productDetailSkeletonMediaWide(), 'aspect-4/5', PULSE)} />
        </div>

        <div className={cn(productDetailSkeletonInfo(), 'shrink-0')}>
          <div className={productDetailSkeletonHeading()}>
            <div className={cn(productDetailSkeletonEyebrowLine(), PULSE)} />
            <div className={cn(productDetailSkeletonTitleLine(), 'w-3/4', PULSE)} />
            <div className={cn(productDetailSkeletonPriceLine(), PULSE)} />
          </div>

          <div className={productDetailSkeletonColour()}>
            <div className={cn(productDetailSkeletonColourLine(), PULSE)} />
            <div className={productDetailSkeletonSwatches()}>
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className={cn(productDetailSkeletonSwatch(), 'aspect-4/5', PULSE)} />
              ))}
            </div>
          </div>

          <div className={productDetailSkeletonSize()}>
            <div className={cn(productDetailSkeletonSizeLine(), PULSE)} />
            <div className={productDetailSkeletonSizes()}>
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className={cn(productDetailSkeletonSizeCell(), PULSE)} />
              ))}
            </div>
          </div>

          <div className={cn(productDetailSkeletonButtonLine(), PULSE)} />
        </div>
      </div>
    </main>
  )
}
