import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { useSuspenseProduct } from '#/features/products/api/products'
import { EditProductOrganizationForm } from '#/features/products/components/edit-product-organization-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/organization')({
  // The category picker browses the whole tree.
  loader: ({ context }) => context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
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
