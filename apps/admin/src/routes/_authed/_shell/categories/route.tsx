import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/categories')({
  staticData: { breadcrumb: msg`Categories` },
  component: () => <Outlet />,
})
