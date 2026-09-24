import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/users')({
  staticData: { breadcrumb: msg`Users` },
  component: () => <Outlet />,
})
