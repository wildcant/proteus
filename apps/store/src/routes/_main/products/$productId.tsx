import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { productQueryOptions } from '#/features/products/api/products'
import { ProductDetail } from '#/features/products/components/product-detail'
import { ProductDetailSkeleton } from '#/features/products/components/product-detail-skeleton'

export const Route = createFileRoute('/_main/products/$productId')({
  component: ProductDetailPage,
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(productQueryOptions(params.productId))
  },
  headers: () => ({
    // Shorter cache due to inventory changes
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
  }),
  staleTime: 30_000,
})

function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  )
}
