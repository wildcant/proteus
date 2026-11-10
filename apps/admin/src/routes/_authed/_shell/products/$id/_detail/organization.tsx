import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { ensureOrganizationOptions } from '#/features/products/api/organization-options'
import { useSuspenseProduct } from '#/features/products/api/products'
import { EditProductOrganizationForm } from '#/features/products/components/edit-product-organization-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/organization')({
  loader: ({ context }) => ensureOrganizationOptions(context.queryClient),
  component: EditProductOrganizationRoute,
})

function EditProductOrganizationRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseProduct(id)

  return (
    <RouteDrawer>
      <EditProductOrganizationForm product={data.product} />
    </RouteDrawer>
  )
}
