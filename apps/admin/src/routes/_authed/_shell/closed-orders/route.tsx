import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/closed-orders')({
  staticData: { breadcrumb: msg`Closed orders` },
  component: () => <Outlet />,
})
