import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'
import { orderQueryOptions } from '#/features/orders/api/orders'
import { OrderConfirmedContent } from '#/features/orders/components/order-confirmed-content'
import { OrderConfirmedSkeleton } from '#/features/orders/components/order-confirmed-skeleton'

export const Route = createFileRoute('/_main/order/$orderId/confirmed')({
  component: OrderConfirmedPage,
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(orderQueryOptions(params.orderId))
  },
})

function OrderConfirmedPage() {
  return (
    <Suspense fallback={<OrderConfirmedSkeleton />}>
      <OrderConfirmedContent />
    </Suspense>
  )
}
