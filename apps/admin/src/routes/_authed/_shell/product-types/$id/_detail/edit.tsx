import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { productTypeQueryOptions, useSuspenseProductType } from '#/features/product-types/api/product-types'
import { EditProductTypeForm } from '#/features/product-types/components/edit-product-type-form'

export const Route = createFileRoute('/_authed/_shell/product-types/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTypeQueryOptions(params.id)),
  component: EditProductTypeRoute,
})

function EditProductTypeRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseProductType(id)

  return (
    <RouteDrawer>
      <EditProductTypeForm type={data.type} />
    </RouteDrawer>
  )
}
