import { createFileRoute } from '@tanstack/react-router'
import { SettingsLayout } from '#/components/layout/settings-layout'

export const Route = createFileRoute('/_authed/settings')({
  staticData: { breadcrumb: 'Settings' },
  component: () => (
    <SettingsLayout
      groups={[
        {
          label: 'General',
          items: [
            { label: 'Store', to: '/settings/store' },
            { label: 'Users', to: '/settings/users' },
            { label: 'Regions', to: '/settings/regions' },
          ],
        },
        {
          label: 'Developer',
          items: [{ label: 'Workflows', to: '/settings/workflows' }],
        },
        {
          label: 'My Account',
          items: [{ label: 'Profile', to: '/settings/profile' }],
        },
      ]}
    />
  ),
})
