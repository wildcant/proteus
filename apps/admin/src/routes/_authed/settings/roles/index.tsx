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
  const roles = useRoleTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={roles}
        className="flex-1"
        heading="Roles"
        description="Roles define what actions users can perform. Assign permissions to control access across your store."
        actions={[{ label: 'Create', to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
