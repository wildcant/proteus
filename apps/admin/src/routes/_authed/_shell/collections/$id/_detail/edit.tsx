import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { collectionQueryOptions, useSuspenseCollection } from '#/features/collections/api/collections'
import { EditCollectionForm } from '#/features/collections/components/edit-collection-form'

export const Route = createFileRoute('/_authed/_shell/collections/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(collectionQueryOptions(params.id)),
  component: EditCollectionRoute,
})

function EditCollectionRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseCollection(id)

  return (
    <RouteDrawer>
      <EditCollectionForm collection={data.collection} />
    </RouteDrawer>
  )
}
