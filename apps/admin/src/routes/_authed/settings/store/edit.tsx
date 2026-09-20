import { RouteDrawer } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { regionsListQueryOptions } from '#/features/regions/api/regions'
import { storeQueryOptions, useSuspenseStore } from '#/features/store/api/store'
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
  const { data } = useSuspenseStore()

  return (
    <RouteDrawer>
      <EditStoreForm store={data.store} />
    </RouteDrawer>
  )
}
