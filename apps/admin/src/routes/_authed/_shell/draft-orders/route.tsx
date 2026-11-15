import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/draft-orders')({
  staticData: { breadcrumb: msg`Draft orders` },
  component: () => <Outlet />,
})
