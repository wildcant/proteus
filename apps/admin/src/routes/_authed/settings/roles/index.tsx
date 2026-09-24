import { useLingui } from '@lingui/react/macro'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { rolesListQueryOptions } from '#/features/access-control/api/roles'
import { useRoleTable } from '#/features/access-control/hooks/use-role-table'

export const Route = createFileRoute('/_authed/settings/roles/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(rolesListQueryOptions()),
  component: RolesPage,
})

function RolesPage() {
  const { t } = useLingui()
  const roles = useRoleTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={roles}
        className="flex-1"
        heading={t`Roles`}
        description={t`Roles define what actions users can perform. Assign permissions to control access across your store.`}
        actions={[{ label: t`Create`, to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
