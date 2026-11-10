import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { categoryTreeQueryOptions } from '#/features/categories/api/categories'
import { allCollectionsQueryOptions } from '#/features/collections/api/collections'
import { allProductTypesQueryOptions } from '#/features/product-types/api/product-types'
import { useSuspenseProduct } from '#/features/products/api/products'
import { EditProductOrganizationForm } from '#/features/products/components/edit-product-organization-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/organization')({
  // The category picker browses the whole tree; the Collections and Type selects offer every row.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(categoryTreeQueryOptions()),
      context.queryClient.ensureQueryData(allCollectionsQueryOptions()),
      context.queryClient.ensureQueryData(allProductTypesQueryOptions()),
    ]),
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
