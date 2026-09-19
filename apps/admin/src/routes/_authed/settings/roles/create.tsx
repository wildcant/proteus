import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { CreateRoleForm } from '#/features/access-control/components/create-role-form'

export const Route = createFileRoute('/_authed/settings/roles/create')({
  component: CreateRoleRoute,
})

function CreateRoleRoute() {
  return (
    <RouteFocusModal>
      <CreateRoleForm />
    </RouteFocusModal>
  )
}
