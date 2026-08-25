import { RouteFocusModal } from '@proteus/ui'
import { createFileRoute } from '@tanstack/react-router'
import { InviteForm } from '#/features/users/components/invite-form'

export const Route = createFileRoute('/_authed/settings/users/invite')({
  component: InviteRoute,
})

function InviteRoute() {
  return (
    <RouteFocusModal>
      <InviteForm />
    </RouteFocusModal>
  )
}
