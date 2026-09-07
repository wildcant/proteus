import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { storeQueryOptions } from '#/features/store/api/store'
import { AddCurrenciesForm } from '#/features/store/components/add-currencies-form'

export const Route = createFileRoute('/_authed/settings/store/currencies')({
  // The store is what says which currencies are already held, and therefore which the picker
  // may offer.
  loader: ({ context }) => context.queryClient.ensureQueryData(storeQueryOptions()),
  component: AddCurrenciesRoute,
})

function AddCurrenciesRoute() {
  return (
    <RouteFocusModal>
      <AddCurrenciesForm />
    </RouteFocusModal>
  )
}
