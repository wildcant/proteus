import { Skeleton } from '@proteus/ui'
import { OrderDetailsSkeleton } from './order-details-skeleton'

export function OrderConfirmedSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-12 pb-16 sm:px-6 lg:px-8">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="mt-4 h-4 w-60" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-8 h-4 w-16" />
      <Skeleton className="mt-2 h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-56" />
      <OrderDetailsSkeleton />
    </main>
  )
}
