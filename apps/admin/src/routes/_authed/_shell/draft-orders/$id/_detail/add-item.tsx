import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { AddDraftItemForm } from '#/features/draft-orders/components/add-draft-item-form'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id/_detail/add-item')({
  component: AddDraftItemRoute,
})

function AddDraftItemRoute() {
  const { id } = Route.useParams()

  return (
    <RouteDrawer>
      <AddDraftItemForm draftOrderId={id} />
    </RouteDrawer>
  )
}
