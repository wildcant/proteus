/**
 * The client-navigation shape. A direct hit is SSR'd with the product already in the markup, so
 * this only ever shows on a cold-cache navigation from the PLP — which is exactly why it has to
 * describe the layout that resolves in: one full-bleed 4:5 block below `lg`, the two-column mosaic
 * above it, and the 410px panel beside it.
 */
export function ProductDetailSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-24">
      <div className="mb-6 h-3 w-40 animate-pulse bg-surface-subtle" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_25.625rem] lg:gap-38">
        <div className="-mx-4 grid gap-1 sm:-mx-6 lg:mx-0 lg:grid-cols-2">
          <div className="aspect-4/5 animate-pulse bg-surface-subtle" />
          <div className="hidden aspect-4/5 animate-pulse bg-surface-subtle lg:block" />
          <div className="hidden aspect-4/5 animate-pulse bg-surface-subtle lg:col-span-2 lg:block" />
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-3">
            <div className="h-3 w-24 animate-pulse bg-surface-subtle" />
            <div className="h-8 w-3/4 animate-pulse bg-surface-subtle" />
            <div className="h-4 w-16 animate-pulse bg-surface-subtle" />
          </div>

          <div className="space-y-2">
            <div className="h-4 w-16 animate-pulse bg-surface-subtle" />
            <div className="flex gap-2">
              <div className="aspect-4/5 w-12 animate-pulse bg-surface-subtle" />
              <div className="aspect-4/5 w-12 animate-pulse bg-surface-subtle" />
              <div className="aspect-4/5 w-12 animate-pulse bg-surface-subtle" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="h-4 w-24 animate-pulse bg-surface-subtle" />
            <div className="grid grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="h-13 animate-pulse border border-line bg-surface-subtle" />
              ))}
            </div>
          </div>

          <div className="h-13 animate-pulse bg-surface-subtle" />
        </div>
      </div>
    </main>
  )
}
