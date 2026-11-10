import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { productTagQueryOptions, useSuspenseProductTag } from '#/features/product-tags/api/product-tags'
import { EditProductTagForm } from '#/features/product-tags/components/edit-product-tag-form'

export const Route = createFileRoute('/_authed/_shell/product-tags/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(productTagQueryOptions(params.id)),
  component: EditProductTagRoute,
})

function EditProductTagRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseProductTag(id)

  return (
    <RouteDrawer>
      <EditProductTagForm tag={data.tag} />
    </RouteDrawer>
  )
}
