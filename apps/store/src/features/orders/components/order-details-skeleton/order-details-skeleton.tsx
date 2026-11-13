import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  orderDetailsSkeleton,
  orderDetailsSkeletonAddressLine,
  orderDetailsSkeletonAddressLines,
  orderDetailsSkeletonAside,
  orderDetailsSkeletonDeliveryPanel,
  orderDetailsSkeletonDeliveryPanelPanelTitle,
  orderDetailsSkeletonDetailLine,
  orderDetailsSkeletonGrandTotal,
  orderDetailsSkeletonGrandTotalLine,
  orderDetailsSkeletonItemsPanel,
  orderDetailsSkeletonItemsTitle,
  orderDetailsSkeletonLines,
  orderDetailsSkeletonMethodLine,
  orderDetailsSkeletonOptionsLine,
  orderDetailsSkeletonPaymentLines,
  orderDetailsSkeletonPaymentPanel,
  orderDetailsSkeletonPaymentPanelPanelTitle,
  orderDetailsSkeletonRow,
  orderDetailsSkeletonRows,
  orderDetailsSkeletonThumbnail,
  orderDetailsSkeletonTitleLine,
  orderDetailsSkeletonTotalLine,
  orderDetailsSkeletonTotals,
} from '#/features/orders/components/order-details-skeleton/order-details-skeleton.variants'

/**
 * The panel grid, at the shape it resolves into. Both routes are SPA-only — neither is
 * `ssr: true` — so this is the first paint on a direct hit, and a skeleton that resolves into a
 * different shape is worse than no skeleton.
 */
export function OrderDetailsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(orderDetailsSkeleton(), className)}>
      <div className={orderDetailsSkeletonItemsPanel()}>
        <Skeleton className={orderDetailsSkeletonItemsTitle()} />
        <div className={orderDetailsSkeletonRows()}>
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className={orderDetailsSkeletonRow()}>
              <Skeleton className={cn(orderDetailsSkeletonThumbnail(), 'aspect-4/5 shrink-0')} />
              <div className={orderDetailsSkeletonLines()}>
                <Skeleton className={orderDetailsSkeletonTitleLine()} />
                <Skeleton className={orderDetailsSkeletonOptionsLine()} />
              </div>
            </div>
          ))}
        </div>
        <div className={orderDetailsSkeletonTotals()}>
          <Skeleton className={orderDetailsSkeletonTotalLine()} />
          <Skeleton className={orderDetailsSkeletonTotalLine()} />
          <div className={orderDetailsSkeletonGrandTotal()}>
            <Skeleton className={orderDetailsSkeletonGrandTotalLine()} />
          </div>
        </div>
      </div>

      <div className={orderDetailsSkeletonAside()}>
        <div className={orderDetailsSkeletonDeliveryPanel()}>
          <Skeleton className={orderDetailsSkeletonDeliveryPanelPanelTitle()} />
          <div className={orderDetailsSkeletonAddressLines()}>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className={orderDetailsSkeletonAddressLine()} />
            ))}
          </div>
        </div>
        <div className={orderDetailsSkeletonPaymentPanel()}>
          <Skeleton className={orderDetailsSkeletonPaymentPanelPanelTitle()} />
          <div className={orderDetailsSkeletonPaymentLines()}>
            <Skeleton className={orderDetailsSkeletonMethodLine()} />
            <Skeleton className={orderDetailsSkeletonDetailLine()} />
          </div>
        </div>
      </div>
    </div>
  )
}
