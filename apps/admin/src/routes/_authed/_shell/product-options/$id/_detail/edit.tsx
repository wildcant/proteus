import { RouteDrawer } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { productOptionQueryOptions } from '#/features/product-options/api/product-options'
import { EditProductOptionForm } from '#/features/product-options/components/edit-product-option-form'

export const Route = createFileRoute('/_authed/_shell/product-options/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productOptionQueryOptions(params.id)),
  component: EditProductOptionRoute,
})

function EditProductOptionRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(productOptionQueryOptions(id))

  return (
    <RouteDrawer>
      <EditProductOptionForm option={data.productOption} />
    </RouteDrawer>
  )
}
