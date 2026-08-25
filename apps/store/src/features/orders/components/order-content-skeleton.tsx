import { Skeleton } from '@proteus/ui'

export function OrderContentSkeleton() {
  return (
    <main className="mx-auto w-full max-w-170 px-4 pt-8 pb-16 sm:px-6">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="mt-6 h-4 w-16" />
      <Skeleton className="mt-2 h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-40" />
      <Skeleton className="mt-8 h-60" />
    </main>
  )
}
