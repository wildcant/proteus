import { createFileRoute } from '@tanstack/react-router'
import { Shell } from '#/components/layout/shell'
import { UserMenu } from '#/features/auth/components/user-menu'
import { NotificationBell } from '#/features/notifications/components/notification-bell'

// The app layer is where features get composed into the shared chrome. Shell holds no feature
// imports of its own; these two are handed to it here.
export const Route = createFileRoute('/_authed/_shell')({
  component: () => <Shell topbarActions={<NotificationBell />} sidebarFooter={<UserMenu />} />,
})
