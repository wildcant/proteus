export function CartSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="mb-8 h-8 w-20 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-4 rounded-lg border border-border p-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded bg-(--bg-subtle)" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-(--bg-subtle)" />
                <div className="h-4 w-1/4 animate-pulse rounded bg-(--bg-subtle)" />
              </div>
            </div>
          ))}
        </div>
        <div className="h-60 animate-pulse rounded-lg border border-border bg-(--bg-subtle)" />
      </div>
    </main>
  )
}
