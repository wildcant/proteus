export function OrderConfirmedSkeleton() {
  return (
    <main className="mx-auto w-full max-w-170 px-4 pt-12 pb-16 sm:px-6">
      <div className="h-8 w-48 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="mt-2 h-6 w-72 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="mt-4 h-4 w-64 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-(--bg-subtle)" />
      <div className="mt-8 h-60 animate-pulse rounded-lg border border-border bg-(--bg-subtle)" />
    </main>
  )
}
