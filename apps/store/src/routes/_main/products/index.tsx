import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import {
  PRODUCTS_DEFAULT_LIMIT,
  PRODUCTS_DEFAULT_OFFSET,
  productsListQueryOptions,
} from '#/features/products/api/products'
import { ProductList } from '#/features/products/components/product-list'
import { ProductListSkeleton } from '#/features/products/components/product-list-skeleton'

export const Route = createFileRoute('/_main/products/')({
  component: ProductsPage,
  loader: ({ context }) => {
    context.queryClient.prefetchQuery(
      productsListQueryOptions({ offset: PRODUCTS_DEFAULT_OFFSET, limit: PRODUCTS_DEFAULT_LIMIT }),
    )
  },
})

function ProductsPage() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>
    </main>
  )
}
