import { Skeleton } from '@proteus/ui'

export function AccountSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="mt-2 h-12 w-72" />

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2 lg:h-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>

      <div className="mt-10 border-line border-t pt-6">
        <Skeleton className="h-5 w-24" />
      </div>
    </main>
  )
}
