import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { productQueryOptions } from '#/features/products/api/products'
import { ProductDetail } from '#/features/products/components/product-detail'
import { ProductDetailSkeleton } from '#/features/products/components/product-detail-skeleton'

export const Route = createFileRoute('/_main/products/$productId')({
  component: ProductDetailPage,
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(productQueryOptions(params.productId))
  },
})

function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetail />
    </Suspense>
  )
}
