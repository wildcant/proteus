import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '#/components/layout/settings-layout'

export const Route = createFileRoute('/_authed/settings')({
  staticData: { breadcrumb: 'Settings' },
  component: SettingsRoute,
})

function SettingsRoute() {
  const { settingsSidebar } = Route.useRouteContext()
  return <SettingsLayout groups={settingsSidebar} />
}
