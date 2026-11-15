import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseDraftOrder } from '#/features/draft-orders/api/draft-orders'
import { ConvertDraftForm } from '#/features/draft-orders/components/convert-draft-form'

export const Route = createFileRoute('/_authed/_shell/draft-orders/$id/_detail/convert')({
  component: ConvertDraftRoute,
})

function ConvertDraftRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseDraftOrder(id)

  return (
    <RouteDrawer>
      <ConvertDraftForm draftOrder={data.draftOrder} />
    </RouteDrawer>
  )
}
