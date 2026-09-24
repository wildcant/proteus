import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/orders')({
  staticData: { breadcrumb: msg`Orders` },
  component: () => <Outlet />,
})
