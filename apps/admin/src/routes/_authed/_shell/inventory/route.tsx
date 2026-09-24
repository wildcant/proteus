import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/inventory')({
  staticData: { breadcrumb: msg`Inventory` },
  component: () => <Outlet />,
})
