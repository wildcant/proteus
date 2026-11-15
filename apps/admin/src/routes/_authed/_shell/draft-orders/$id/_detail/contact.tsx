import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseDraftOrder } from '#/features/draft-orders/api/draft-orders'
import { EditDraftContactForm } from '#/features/draft-orders/components/edit-draft-contact-form'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id/_detail/contact')({
  component: EditDraftContactRoute,
})

function EditDraftContactRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseDraftOrder(id)

  return (
    <RouteDrawer>
      <EditDraftContactForm draftOrder={data.draftOrder} />
    </RouteDrawer>
  )
}
