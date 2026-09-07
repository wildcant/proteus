import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { selectableCountriesQueryOptions } from '#/features/regions/api/countries'
import { AddCountriesForm } from '#/features/regions/components/add-countries-form'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/countries/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(selectableCountriesQueryOptions()),
  component: AddCountriesRoute,
})

function AddCountriesRoute() {
  const { id } = Route.useParams()

  return (
    <RouteFocusModal>
      <AddCountriesForm regionId={id} />
    </RouteFocusModal>
  )
}
