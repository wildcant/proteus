import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  cartDrawerSkeleton,
  cartDrawerSkeletonFooter,
  cartDrawerSkeletonInfo,
  cartDrawerSkeletonLines,
  cartDrawerSkeletonOptionsLine,
  cartDrawerSkeletonPriceLine,
  cartDrawerSkeletonRow,
  cartDrawerSkeletonStepperLine,
  cartDrawerSkeletonThumbnail,
  cartDrawerSkeletonTitleLine,
} from '#/features/cart/components/cart-drawer-skeleton/cart-drawer-skeleton.variants'

/**
 * Three rows at `CartItem`'s metrics. Exists because `useCart` does not suspend: without it
 * a cold `?modal=cart` with items in the bag shows "Your bag is empty" for the width of a request.
 */
export function CartDrawerSkeleton() {
  return (
    <div className={cartDrawerSkeleton()}>
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className={cartDrawerSkeletonRow()}>
          <Skeleton className={cn(cartDrawerSkeletonThumbnail(), 'aspect-4/5 shrink-0 self-start')} />
          <div className={cartDrawerSkeletonInfo()}>
            <div className={cartDrawerSkeletonLines()}>
              <Skeleton className={cn(cartDrawerSkeletonTitleLine(), 'w-2/3')} />
              <Skeleton className={cn(cartDrawerSkeletonOptionsLine(), 'w-1/3')} />
            </div>
            <div className={cartDrawerSkeletonFooter()}>
              <Skeleton className={cartDrawerSkeletonPriceLine()} />
              <Skeleton className={cartDrawerSkeletonStepperLine()} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
