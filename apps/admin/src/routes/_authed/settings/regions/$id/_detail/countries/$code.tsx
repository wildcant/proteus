import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { regionCountriesQueryOptions, useRegionCountry } from '#/features/regions/api/countries'
import { EditCountryLocaleForm } from '#/features/regions/components/edit-country-locale-form'

export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/countries/$code')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(regionCountriesQueryOptions(params.id)),
  component: EditCountryLocaleRoute,
})

function EditCountryLocaleRoute() {
  const { id, code } = Route.useParams()
  const { country } = useRegionCountry(id, code)

  // The loader has already resolved the region's countries, so a missing one means the code names a
  // country this region does not sell to — nothing to edit, and the drawer stays closed.
  if (!country) return null

  return (
    <RouteDrawer>
      <EditCountryLocaleForm regionId={id} country={country} />
    </RouteDrawer>
  )
}
