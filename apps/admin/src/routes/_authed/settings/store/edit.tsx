import { RouteDrawer } from '@proteus/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { regionsListQueryOptions } from '#/features/regions/api/regions'
import { storeQueryOptions } from '#/features/store/api/store'
import { EditStoreForm } from '#/features/store/components/edit-store-form'

export const Route = createFileRoute('/_authed/settings/store/edit')({
  // The regions are the selector's options, so the drawer opens filled rather than empty.
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(storeQueryOptions()),
      context.queryClient.ensureQueryData(regionsListQueryOptions()),
    ]),
  component: EditStoreRoute,
})

function EditStoreRoute() {
  const { data } = useSuspenseQuery(storeQueryOptions())

  return (
    <RouteDrawer>
      <EditStoreForm store={data.store} />
    </RouteDrawer>
  )
}
