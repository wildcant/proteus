import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  checkoutSkeleton,
  checkoutSkeletonBand,
  checkoutSkeletonField,
  checkoutSkeletonForm,
  checkoutSkeletonFormPane,
  checkoutSkeletonStep,
  checkoutSkeletonStepTitle,
  checkoutSkeletonSummary,
  checkoutSkeletonSummaryBlock,
  checkoutSkeletonSummaryLines,
  checkoutSkeletonSummaryPane,
  checkoutSkeletonSummaryTitle,
} from '#/features/checkout/components/checkout-skeleton/checkout-skeleton.variants'

/**
 * The split, drawn empty. It mirrors `CheckoutContent`'s two panes rather than being a generic
 * block stack, so a cold `/checkout` does not reflow under the shopper when the cart resolves.
 *
 * The summary comes first in the markup, as the phone shows it; from `lg` the form takes the left
 * column (`lg:order-*`), as `CheckoutContent` reverses its row. The drawing keeps the markup order.
 */
export function CheckoutSkeleton() {
  return (
    <main className={checkoutSkeleton()}>
      <div className={cn(checkoutSkeletonSummaryPane(), 'lg:order-2')}>
        {/* The phone's disclosure band, at its real height so nothing below it moves. */}
        <div className={checkoutSkeletonBand()} />
        <div className={checkoutSkeletonSummary()}>
          <div className={checkoutSkeletonSummaryLines()}>
            <Skeleton className={checkoutSkeletonSummaryTitle()} />
            <Skeleton className={checkoutSkeletonSummaryBlock()} />
            <Skeleton className={checkoutSkeletonSummaryBlock()} />
          </div>
        </div>
      </div>

      <div className={cn(checkoutSkeletonFormPane(), 'lg:order-1')}>
        <div className={cn(checkoutSkeletonForm(), 'mx-auto w-full lg:mr-0 lg:ml-auto')}>
          <div className={checkoutSkeletonStep()}>
            <Skeleton className={checkoutSkeletonStepTitle()} />
            <Skeleton className={checkoutSkeletonField()} />
          </div>
          <div className={checkoutSkeletonStep()}>
            <Skeleton className={checkoutSkeletonStepTitle()} />
            <Skeleton className={checkoutSkeletonField()} />
            <Skeleton className={checkoutSkeletonField()} />
            <Skeleton className={checkoutSkeletonField()} />
          </div>
        </div>
      </div>
    </main>
  )
}
