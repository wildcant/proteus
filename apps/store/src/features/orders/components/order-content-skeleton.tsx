import { Skeleton } from '@proteus/ui'
import { OrderDetailsSkeleton } from './order-details-skeleton'

export function OrderContentSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-6 h-4 w-16" />
      <Skeleton className="mt-2 h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-56" />
      <OrderDetailsSkeleton />
    </main>
  )
}
