import { Skeleton } from '@proteus/ui'

/**
 * The panel grid, at the shape it resolves into. Both routes are SPA-only — neither is
 * `ssr: true` — so this is the first paint on a direct hit, and a skeleton that resolves into a
 * different shape is worse than no skeleton.
 */
export function OrderDetailsSkeleton() {
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col bg-surface-subtle p-6 lg:col-span-2 lg:p-10">
        <Skeleton className="h-5 w-28" />
        <div className="mt-6 flex flex-col gap-4">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="flex gap-4">
              <Skeleton className="aspect-4/5 w-16 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 border-line border-t pt-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-2 h-5 w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col bg-surface-subtle p-6 lg:p-10">
          <Skeleton className="h-5 w-24" />
          <div className="mt-6 flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-3 w-36" />
            ))}
          </div>
        </div>
        <div className="flex flex-col bg-surface-subtle p-6 lg:p-10">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-6 h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-44" />
        </div>
      </div>
    </div>
  )
}
