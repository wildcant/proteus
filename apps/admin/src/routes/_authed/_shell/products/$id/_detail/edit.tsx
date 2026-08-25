import { RouteDrawer } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { productQueryOptions } from '#/features/products/api/products'
import { EditProductForm } from '#/features/products/components/edit-product-form'

export const Route = createFileRoute('/_authed/_shell/products/$id/_detail/edit')({
  component: EditProductRoute,
})

function EditProductRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(productQueryOptions(id))

  return (
    <RouteDrawer>
      <EditProductForm product={data.product} />
    </RouteDrawer>
  )
}
