import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/reservations')({
  staticData: { breadcrumb: msg`Reservations` },
  component: () => <Outlet />,
})
