import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { usersListQueryOptions } from '#/features/users/api/users'
import { useUserTable } from '#/features/users/hooks/use-user-table'

export const Route = createFileRoute('/_authed/settings/users/')({
  // The list is also the permission gate: a caller without `user.read` gets a 403 here, which the
  // `_authed` error boundary renders as Access Denied. Fetched in the component alone, the same
  // 403 was swallowed into an empty table that read as "no users yet".
  loader: ({ context }) => context.queryClient.ensureQueryData(usersListQueryOptions()),
  component: UsersPage,
})

function UsersPage() {
  const { t } = useLingui()
  const users = useUserTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={users} heading={t`Users`} actions={[{ label: t`Invite Users`, to: 'invite' }]} />
    </PageLayout.SingleColumn>
  )
}
