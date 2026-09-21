import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/customers')({
  staticData: { breadcrumb: 'Customers' },
  component: () => <Outlet />,
})
