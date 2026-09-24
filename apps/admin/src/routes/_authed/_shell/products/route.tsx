import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/products')({
  staticData: { breadcrumb: msg`Products` },
  component: () => <Outlet />,
})
