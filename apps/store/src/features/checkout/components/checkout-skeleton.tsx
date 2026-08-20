export function CheckoutSkeleton() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="h-8 w-40 animate-pulse rounded bg-(--bg-subtle)" />
          <div className="space-y-4">
            <div className="h-10 w-full animate-pulse rounded bg-(--bg-subtle)" />
            <div className="h-10 w-full animate-pulse rounded bg-(--bg-subtle)" />
            <div className="h-10 w-full animate-pulse rounded bg-(--bg-subtle)" />
          </div>
        </div>
        <div className="h-60 animate-pulse rounded-lg border border-border bg-(--bg-subtle)" />
      </div>
    </main>
  )
}
