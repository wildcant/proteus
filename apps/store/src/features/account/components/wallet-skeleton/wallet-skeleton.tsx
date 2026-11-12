import { cn } from '@proteus/ui-core'
import { PaymentRow } from '#/components/store/payment-row/payment-row'
import { paymentRowContent } from '#/components/store/payment-row/payment-row.variants'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  walletSkeleton,
  walletSkeletonLine,
  walletSkeletonMark,
  walletSkeletonRemove,
  walletSkeletonRow,
  walletSkeletonText,
} from '#/features/account/components/wallet-skeleton/wallet-skeleton.variants'

/**
 * The account wallet while it is read: two placeholder rows on `PaymentRow`, so a row comes out at
 * its tallest child (the 32px Remove) plus the row's padding, the height a real card row measures.
 *
 * The checkout selector keeps its own copy beside `SavedCardRow` until this set moves to the
 * payment-method entity's page: two features can't share a component.
 *
 * `aria-hidden` because a placeholder names nothing, and two announced empty rows are worse than
 * the silence before the list arrives.
 */
export function WalletSkeleton() {
  return (
    <div className={walletSkeleton()} data-testid="wallet-skeleton" aria-hidden="true">
      {Array.from({ length: 2 }, (_, index) => (
        <PaymentRow key={index} className={walletSkeletonRow()}>
          <div className={cn(paymentRowContent(), 'min-w-0')}>
            <Skeleton className={cn(walletSkeletonMark(), 'shrink-0')} />
            <div className={walletSkeletonText()}>
              <Skeleton className={walletSkeletonLine()} />
            </div>
            <Skeleton className={cn(walletSkeletonRemove(), 'shrink-0')} />
          </div>
        </PaymentRow>
      ))}
    </div>
  )
}
