import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/orders')({
  staticData: { breadcrumb: 'Orders' },
  component: () => <Outlet />,
})
