import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateCollectionForm } from '#/features/collections/components/create-collection-form'

export const Route = createFileRoute('/_authed/_shell/collections/create')({
  component: CreateCollectionRoute,
})

function CreateCollectionRoute() {
  return (
    <RouteFocusModal>
      <CreateCollectionForm />
    </RouteFocusModal>
  )
}
