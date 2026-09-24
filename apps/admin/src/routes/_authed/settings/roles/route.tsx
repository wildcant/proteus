import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/roles')({
  staticData: { breadcrumb: msg`Roles` },
  component: () => <Outlet />,
})
