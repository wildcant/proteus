import { useLingui } from '@lingui/react/macro'
import type { AdminRoleListResponseRolesItem } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useRoles } from '#/features/access-control/api/roles'
import { RoleRowActions } from '#/features/access-control/components/role-row-actions'

export const useRoleTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminRoleListResponseRolesItem>({
    useData: () => {
      const { data, isPending, isFetching } = useRoles()
      return {
        data: data?.roles ?? [],
        count: data?.roles.length,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.display('name', {
        header: t`Name`,
        cell: ({ row }) => (
          <span className="flex items-center gap-x-2">
            {row.name}
            {!!row.protected && (
              <span className="text-muted-foreground" title={t`Protected role`}>
                🔒
              </span>
            )}
          </span>
        ),
      }),
      col.display('userCount', {
        header: t`Users`,
        cell: ({ row }) => row.userCount,
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/settings/roles/${row.id}`,
    rowActions: (row) => <RoleRowActions role={row} />,

    empty: {
      heading: t`No roles`,
      description: t`Create a role to manage permissions.`,
    },
    filtered: {
      heading: t`No roles found`,
      description: t`Try changing your search term.`,
    },
  })
}
