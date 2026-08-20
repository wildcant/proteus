import { PRODUCTS_DEFAULT_LIMIT } from '#/features/products/api/products'

export function ProductListSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: PRODUCTS_DEFAULT_LIMIT }, (_, index) => (
        <div key={index}>
          <div className="aspect-3/4 animate-pulse bg-(--bg-subtle)" />
          <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-(--bg-subtle)" />
          <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-(--bg-subtle)" />
        </div>
      ))}
    </div>
  )
}
