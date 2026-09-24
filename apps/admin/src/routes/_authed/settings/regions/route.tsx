import { msg } from '@lingui/core/macro'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/regions')({
  staticData: { breadcrumb: msg`Regions` },
  component: () => <Outlet />,
})
