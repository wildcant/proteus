import { createFileRoute, Link } from '@tanstack/react-router'
import { Suspense } from 'react'
import { Button } from '#/components/button'
import { orderQueryOptions } from '#/features/orders/api/orders'
import { OrderConfirmedContent } from '#/features/orders/components/order-confirmed-content'
import { OrderConfirmedSkeleton } from '#/features/orders/components/order-confirmed-skeleton'
import { OrderError } from '#/features/orders/components/order-error'

export const Route = createFileRoute('/_main/order/$orderId/confirmed')({
  component: OrderConfirmedPage,
  errorComponent: OrderConfirmedError,
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

// TODO(monitoring): the store has no error-reporting transport, so this boundary renders
// politely and tells nobody. Wire it up here when one lands.
function OrderConfirmedError() {
  const { orderId } = Route.useParams()

  return (
    // Continue shopping, not "back to account": a guest who just checked out has no account.
    <OrderError orderId={orderId}>
      <Button variant="outline" render={<Link to="/" />}>
        Continue shopping
      </Button>
    </OrderError>
  )
}
