import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseDraftOrder } from '#/features/draft-orders/api/draft-orders'
import { shippingOptionsListQueryOptions } from '#/features/draft-orders/api/shipping-options'
import { EditDraftShippingForm } from '#/features/draft-orders/components/edit-draft-shipping-form'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id/_detail/shipping')({
  loader: ({ context }) => context.queryClient.ensureQueryData(shippingOptionsListQueryOptions()),
  component: EditDraftShippingRoute,
})

function EditDraftShippingRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseDraftOrder(id)

  return (
    <RouteDrawer>
      <EditDraftShippingForm draftOrder={data.draftOrder} />
    </RouteDrawer>
  )
}
