import { Skeleton } from '@proteus/ui'

/**
 * The split, drawn empty. It mirrors `CheckoutContent`'s two panes rather than being a generic
 * block stack, so a cold `/checkout` does not reflow under the shopper when the cart resolves.
 */
export function CheckoutSkeleton() {
  return (
    <main className="lg:grid lg:grid-cols-2">
      <div className="bg-surface lg:order-2 lg:bg-surface-subtle">
        {/* The phone's disclosure band, at its real height so nothing below it moves. */}
        <div className="h-16 border-line border-b bg-surface-subtle lg:hidden" />
        <div className="hidden px-10 lg:block">
          <div className="w-full max-w-100 space-y-4 py-10">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>

      <div className="bg-surface px-4 pt-8 pb-16 lg:order-1 lg:px-10 lg:pt-10">
        <div className="mx-auto w-full max-w-125 space-y-8 lg:mr-0 lg:ml-auto">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-14 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </div>
    </main>
  )
}
