import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { orderQueryOptions } from '#/features/orders/api/orders'
import { OrderContent } from '#/features/orders/components/order-content'
import { OrderContentSkeleton } from '#/features/orders/components/order-content-skeleton'

export const Route = createFileRoute('/_main/_authed/account/orders/$orderId')({
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(orderQueryOptions(params.orderId))
  },
  component: () => (
    <Suspense fallback={<OrderContentSkeleton />}>
      <OrderContent />
    </Suspense>
  ),
})
