export function ProductDetailSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pb-24">
      <div className="mb-8 h-3 w-40 animate-pulse bg-(--bg-subtle)" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-16">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="order-2 flex gap-3 lg:order-1 lg:w-20 lg:flex-col">
            <div className="aspect-3/4 w-16 animate-pulse bg-(--bg-subtle) lg:w-full" />
            <div className="aspect-3/4 w-16 animate-pulse bg-(--bg-subtle) lg:w-full" />
          </div>
          <div className="order-1 aspect-3/4 flex-1 animate-pulse bg-(--bg-subtle) lg:order-2" />
        </div>
        <div className="flex flex-col gap-8">
          <div className="space-y-4">
            <div className="h-11 w-3/4 animate-pulse bg-(--bg-subtle)" />
            <div className="h-5 w-24 animate-pulse bg-(--bg-subtle)" />
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="h-3 w-12 animate-pulse bg-(--bg-subtle)" />
              <div className="flex gap-2">
                <div className="h-10 w-11 animate-pulse bg-(--bg-subtle)" />
                <div className="h-10 w-11 animate-pulse bg-(--bg-subtle)" />
                <div className="h-10 w-11 animate-pulse bg-(--bg-subtle)" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-16 animate-pulse bg-(--bg-subtle)" />
              <div className="flex gap-2">
                <div className="size-11 animate-pulse rounded-full bg-(--bg-subtle)" />
                <div className="size-11 animate-pulse rounded-full bg-(--bg-subtle)" />
              </div>
            </div>
          </div>
          <div className="h-11 animate-pulse bg-(--bg-subtle)" />
        </div>
      </div>
    </main>
  )
}
