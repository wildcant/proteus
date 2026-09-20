import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { regionQueryOptions, useSuspenseRegion } from '#/features/regions/api/regions'
import { EditRegionForm } from '#/features/regions/components/edit-region-form'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(regionQueryOptions(params.id)),
  component: EditRegionRoute,
})

function EditRegionRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseRegion(id)

  return (
    <RouteDrawer>
      <EditRegionForm region={data.region} />
    </RouteDrawer>
  )
}
