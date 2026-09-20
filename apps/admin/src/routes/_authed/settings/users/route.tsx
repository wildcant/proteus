import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/users')({
  staticData: { breadcrumb: 'Users' },
  component: () => <Outlet />,
})
