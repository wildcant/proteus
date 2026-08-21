import { Skeleton } from '@proteus/ui'

export function AccountSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-56" />
      </div>
      <div className="border-border border-t pt-8">
        <div className="mb-8 flex flex-col gap-y-2">
          <Skeleton className="h-7 w-16" />
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-44" />
          </div>
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </main>
  )
}
