import { Skeleton } from '@proteus/ui'
import { OrderDetailsSkeleton } from './order-details-skeleton'

export function OrderContentSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-6 h-8 w-44" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-6 flex max-w-200 gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-0.5 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <OrderDetailsSkeleton />
    </main>
  )
}
