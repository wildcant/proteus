import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  orderContentSkeleton,
  orderContentSkeletonBackLine,
  orderContentSkeletonBarLine,
  orderContentSkeletonDateLine,
  orderContentSkeletonDetails,
  orderContentSkeletonHeading,
  orderContentSkeletonStep,
  orderContentSkeletonStepLine,
  orderContentSkeletonTitleLine,
  orderContentSkeletonTop,
  orderContentSkeletonTrack,
} from '#/features/orders/components/order-content-skeleton/order-content-skeleton.variants'
import { OrderDetailsSkeleton } from '#/features/orders/components/order-details-skeleton/order-details-skeleton'

export function OrderContentSkeleton() {
  return (
    <main className={cn(orderContentSkeleton(), 'mx-auto w-full max-w-350')}>
      <div className={orderContentSkeletonTop()}>
        <Skeleton className={orderContentSkeletonBackLine()} />
        <div className={orderContentSkeletonHeading()}>
          <Skeleton className={orderContentSkeletonTitleLine()} />
          <Skeleton className={orderContentSkeletonDateLine()} />
        </div>
        <div className={orderContentSkeletonTrack()}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={orderContentSkeletonStep()}>
              <Skeleton className={orderContentSkeletonBarLine()} />
              <Skeleton className={orderContentSkeletonStepLine()} />
            </div>
          ))}
        </div>
      </div>
      <OrderDetailsSkeleton className={orderContentSkeletonDetails()} />
    </main>
  )
}
