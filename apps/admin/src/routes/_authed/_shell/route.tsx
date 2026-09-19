import { createFileRoute } from '@tanstack/react-router'
import { Shell } from '#/components/layout/shell'
import { useMe } from '#/features/auth/api/auth'
import { UserMenu } from '#/features/auth/components/user-menu'
import { NotificationBell } from '#/features/notifications/components/notification-bell'

export const Route = createFileRoute('/_authed/_shell')({
  component: ShellRoute,
})

function ShellRoute() {
  const routeContext = Route.useRouteContext()
  const me = useMe()
  const sidebar = me.sidebar ?? routeContext.sidebar
  const settingsSidebar = me.settingsSidebar ?? routeContext.settingsSidebar
  return (
    <Shell
      sidebar={sidebar}
      settingsSidebar={settingsSidebar}
      topbarActions={<NotificationBell />}
      sidebarFooter={<UserMenu />}
    />
  )
}
