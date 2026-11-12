import { cn } from '@proteus/ui-core'
import { PRODUCTS_DEFAULT_LIMIT } from '#/features/products/api/products'
import {
  productListSkeleton,
  productListSkeletonCard,
  productListSkeletonInfo,
  productListSkeletonLines,
  productListSkeletonMedia,
  productListSkeletonPriceLine,
  productListSkeletonSubtitleLine,
  productListSkeletonTitleLine,
} from '#/features/products/components/product-list-skeleton/product-list-skeleton.variants'

/**
 * Grid only. The page header, the bar and the sort control sit outside the boundary this stands
 * in for, so they are already on screen and there is nothing here to stand in for them.
 */
export function ProductListSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(productListSkeleton(), className)}>
      {Array.from({ length: PRODUCTS_DEFAULT_LIMIT }, (_, index) => (
        <div key={index} className={productListSkeletonCard()}>
          <div className={cn(productListSkeletonMedia(), 'aspect-4/5 animate-pulse')} />
          <div className={productListSkeletonInfo()}>
            <div className={productListSkeletonLines()}>
              <div className={cn(productListSkeletonTitleLine(), 'w-3/4 animate-pulse')} />
              <div className={cn(productListSkeletonSubtitleLine(), 'w-1/2 animate-pulse')} />
            </div>
            <div className={cn(productListSkeletonPriceLine(), 'w-1/3 animate-pulse')} />
          </div>
        </div>
      ))}
    </div>
  )
}
