import { PRODUCTS_DEFAULT_LIMIT } from '#/features/products/api/products'

/**
 * Grid only. The page header, the bar and the sort control sit outside the boundary this stands
 * in for, so they are already on screen and there is nothing here to stand in for them.
 *
 * The grid classes are ProductGrid's, copied rather than shared — see that file.
 */
export function ProductListSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-1 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: PRODUCTS_DEFAULT_LIMIT }, (_, index) => (
        <div key={index}>
          <div className="aspect-4/5 animate-pulse bg-surface-subtle" />
          <div className="py-2 lg:p-4">
            <div className="h-4 w-3/4 animate-pulse bg-surface-subtle" />
            <div className="mt-1 h-4 w-1/2 animate-pulse bg-surface-subtle" />
            <div className="mt-4 h-4 w-1/3 animate-pulse bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  )
}
