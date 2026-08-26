import { Skeleton } from '@proteus/ui'

/**
 * Three rows at `CartItem`'s metrics. Exists because `useCart` does not suspend: without it
 * a cold `?modal=cart` with items in the bag shows "Your bag is empty" for the width of a request.
 */
export function CartDrawerSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="flex gap-3">
          <Skeleton className="aspect-4/5 w-17 shrink-0 self-start" />
          <div className="flex flex-1 flex-col justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-22" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
