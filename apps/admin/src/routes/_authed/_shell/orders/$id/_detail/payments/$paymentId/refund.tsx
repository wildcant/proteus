import { RouteDrawer } from '@proteus/ui'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { RefundPaymentForm } from '#/features/orders/components/refund-payment-form'

export const Route = createFileRoute('/_authed/_shell/orders/$id/_detail/payments/$paymentId/refund')({
  component: RefundPaymentRoute,
})

function RefundPaymentRoute() {
  const { id, paymentId } = Route.useParams()
  const { data } = useSuspenseOrder(id)
  const payment = data.order.paymentCollections
    .flatMap((collection) => collection.payments ?? [])
    .find((row) => row.id === paymentId)

  if (!payment) throw notFound()

  return (
    <RouteDrawer prev={`/orders/${id}`}>
      <RefundPaymentForm orderId={id} payment={payment} />
    </RouteDrawer>
  )
}
