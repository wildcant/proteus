import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/roles')({
  staticData: { breadcrumb: 'Roles' },
  component: () => <Outlet />,
})
