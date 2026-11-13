import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  orderConfirmedSkeleton,
  orderConfirmedSkeletonBarLine,
  orderConfirmedSkeletonDateLine,
  orderConfirmedSkeletonDetails,
  orderConfirmedSkeletonDisplayLine,
  orderConfirmedSkeletonEmailLine,
  orderConfirmedSkeletonHeading,
  orderConfirmedSkeletonIntro,
  orderConfirmedSkeletonIntroLines,
  orderConfirmedSkeletonNoteLine,
  orderConfirmedSkeletonStep,
  orderConfirmedSkeletonStepLine,
  orderConfirmedSkeletonTitleLine,
  orderConfirmedSkeletonTop,
  orderConfirmedSkeletonTrack,
  orderConfirmedSkeletonUpper,
} from '#/features/orders/components/order-confirmed-skeleton/order-confirmed-skeleton.variants'
import { OrderDetailsSkeleton } from '#/features/orders/components/order-details-skeleton/order-details-skeleton'

export function OrderConfirmedSkeleton() {
  return (
    <main className={cn(orderConfirmedSkeleton(), 'mx-auto w-full max-w-350')}>
      <div className={orderConfirmedSkeletonTop()}>
        <div className={orderConfirmedSkeletonUpper()}>
          <div className={orderConfirmedSkeletonIntro()}>
            <Skeleton className={orderConfirmedSkeletonDisplayLine()} />
            <div className={orderConfirmedSkeletonIntroLines()}>
              <Skeleton className={orderConfirmedSkeletonEmailLine()} />
              <Skeleton className={orderConfirmedSkeletonNoteLine()} />
            </div>
          </div>
          <div className={orderConfirmedSkeletonHeading()}>
            <Skeleton className={orderConfirmedSkeletonTitleLine()} />
            <Skeleton className={orderConfirmedSkeletonDateLine()} />
          </div>
        </div>
        <div className={orderConfirmedSkeletonTrack()}>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className={orderConfirmedSkeletonStep()}>
              <Skeleton className={orderConfirmedSkeletonBarLine()} />
              <Skeleton className={orderConfirmedSkeletonStepLine()} />
            </div>
          ))}
        </div>
      </div>
      <OrderDetailsSkeleton className={orderConfirmedSkeletonDetails()} />
    </main>
  )
}
