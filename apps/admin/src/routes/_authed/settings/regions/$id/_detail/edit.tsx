import { RouteDrawer } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { regionQueryOptions } from '#/features/regions/api/regions'
import { EditRegionForm } from '#/features/regions/components/edit-region-form'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(regionQueryOptions(params.id)),
  component: EditRegionRoute,
})

function EditRegionRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(regionQueryOptions(id))

  return (
    <RouteDrawer>
      <EditRegionForm region={data.region} />
    </RouteDrawer>
  )
}
