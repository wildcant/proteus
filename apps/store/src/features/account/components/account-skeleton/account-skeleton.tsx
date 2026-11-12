import { cn } from '@proteus/ui-core'
import { Skeleton } from '#/components/ui/skeleton/skeleton'
import {
  accountSkeleton,
  accountSkeletonEyebrow,
  accountSkeletonFooter,
  accountSkeletonHeading,
  accountSkeletonOrders,
  accountSkeletonPanel,
  accountSkeletonPanels,
  accountSkeletonSide,
  accountSkeletonSignOut,
  accountSkeletonTitle,
} from '#/features/account/components/account-skeleton/account-skeleton.variants'

export function AccountSkeleton() {
  return (
    <main className={cn(accountSkeleton(), 'mx-auto w-full')}>
      <div className={accountSkeletonHeading()}>
        <Skeleton className={accountSkeletonEyebrow()} />
        <Skeleton className={accountSkeletonTitle()} />
      </div>

      <div className={accountSkeletonPanels()}>
        {/* `lg:h-full`: the grid row stretches the Orders block to the stack beside it. */}
        <Skeleton className={cn(accountSkeletonOrders(), 'lg:h-full')} />
        <div className={accountSkeletonSide()}>
          <Skeleton className={accountSkeletonPanel()} />
          <Skeleton className={accountSkeletonPanel()} />
        </div>
      </div>

      <div className={accountSkeletonFooter()}>
        <Skeleton className={accountSkeletonSignOut()} />
      </div>
    </main>
  )
}
