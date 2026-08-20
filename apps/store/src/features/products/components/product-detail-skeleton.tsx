export function ProductDetailSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="mb-8 h-4 w-40 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-3/4 animate-pulse bg-(--bg-subtle)" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-(--bg-subtle)" />
          <div className="h-5 w-1/4 animate-pulse rounded bg-(--bg-subtle)" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-(--bg-subtle)" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-(--bg-subtle)" />
          </div>
        </div>
      </div>
    </main>
  )
}
