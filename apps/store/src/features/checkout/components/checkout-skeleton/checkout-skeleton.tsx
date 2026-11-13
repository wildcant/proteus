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
 * The form pane comes first in the markup, as the `lg` split reads left to right; the phone stacks the
 * summary on top (`flex-col-reverse`), as `CheckoutContent` does.
 */
export function CheckoutSkeleton() {
  return (
    <main className={checkoutSkeleton()}>
      <div className={checkoutSkeletonFormPane()}>
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

      <div className={checkoutSkeletonSummaryPane()}>
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
    </main>
  )
}
