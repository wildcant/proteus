import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/settings/regions')({
  staticData: { breadcrumb: 'Regions' },
  component: () => <Outlet />,
})
