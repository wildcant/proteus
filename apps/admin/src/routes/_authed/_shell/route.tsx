import { createFileRoute } from '@tanstack/react-router'
import { Shell } from '#/components/layout/shell'
import { UserMenu } from '#/features/auth/components/user-menu'
import { NotificationBell } from '#/features/notifications/components/notification-bell'

export const Route = createFileRoute('/_authed/_shell')({
  component: ShellRoute,
})

function ShellRoute() {
  const { sidebar } = Route.useRouteContext()
  return <Shell sidebar={sidebar} topbarActions={<NotificationBell />} sidebarFooter={<UserMenu />} />
}
