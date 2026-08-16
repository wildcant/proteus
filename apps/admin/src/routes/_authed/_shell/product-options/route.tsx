import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/product-options')({
  staticData: { breadcrumb: 'Options' },
  component: () => <Outlet />,
})
