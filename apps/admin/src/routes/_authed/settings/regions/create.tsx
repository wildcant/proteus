import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateRegionForm } from '#/features/regions/components/create-region-form'

export const Route = createFileRoute('/_authed/settings/regions/create')({
  component: CreateRegionRoute,
})

function CreateRegionRoute() {
  return (
    <RouteFocusModal>
      <CreateRegionForm />
    </RouteFocusModal>
  )
}
