import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { RecordPaymentForm } from '#/features/orders/components/record-payment-form'

export const Route = createFileRoute('/_authed/_shell/orders/$id/_detail/record-payment')({
  component: RecordPaymentRoute,
})

function RecordPaymentRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseOrder(id)

  return (
    <RouteDrawer>
      <RecordPaymentForm order={data.order} />
    </RouteDrawer>
  )
}
