import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'
import { Button } from '#/components/button'
import { orderQueryOptions } from '#/features/orders/api/orders'
import { OrderContent } from '#/features/orders/components/order-content'
import { OrderContentSkeleton } from '#/features/orders/components/order-content-skeleton'
import { OrderError } from '#/features/orders/components/order-error'

export const Route = createFileRoute('/_main/_authed/account/orders/$orderId')({
  loader: ({ context, params }) => {
    context.queryClient.prefetchQuery(orderQueryOptions(params.orderId))
  },
  component: () => (
    <Suspense fallback={<OrderContentSkeleton />}>
      <OrderContent />
    </Suspense>
  ),
  errorComponent: OrderDetailError,
})

// TODO(monitoring): the store has no error-reporting transport, so this boundary renders
// politely and tells nobody. Wire it up here when one lands.
function OrderDetailError() {
  const { orderId } = Route.useParams()

  return (
    <OrderError orderId={orderId}>
      <Button variant="outline" render={<Link to="/account" />}>
        Back to account
      </Button>
    </OrderError>
  )
}
