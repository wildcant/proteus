import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseOrder } from '#/features/orders/api/orders'
import { CancelOrderForm } from '#/features/orders/components/cancel-order-form'

export const Route = createFileRoute('/_authed/_shell/orders/$id/_detail/cancel')({
  component: CancelOrderRoute,
})

function CancelOrderRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseOrder(id)

  return (
    <RouteDrawer>
      <CancelOrderForm order={data.order} />
    </RouteDrawer>
  )
}
