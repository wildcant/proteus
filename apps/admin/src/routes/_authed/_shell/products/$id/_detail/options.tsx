import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ManageProductOptionsForm } from '#/features/product-options/components/manage-product-options-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/options')({
  component: ManageProductOptionsRoute,
})

function ManageProductOptionsRoute() {
  const { id } = Route.useParams()

  return (
    <RouteDrawer>
      <ManageProductOptionsForm productId={id} />
    </RouteDrawer>
  )
}
