import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { useUserTable } from '#/features/users/hooks/use-user-table'

export const Route = createFileRoute('/_authed/settings/users')({
  staticData: { breadcrumb: 'Users' },
  component: UsersPage,
})

function UsersPage() {
  const users = useUserTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={users} heading="Users" actions={[{ label: 'Invite Users', to: 'invite' }]} />
    </PageLayout.SingleColumn>
  )
}
