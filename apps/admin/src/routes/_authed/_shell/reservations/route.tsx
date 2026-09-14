import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/_shell/reservations')({
  staticData: { breadcrumb: 'Reservations' },
  component: () => <Outlet />,
})
