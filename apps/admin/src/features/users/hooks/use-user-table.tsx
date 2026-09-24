import { useLingui } from '@lingui/react/macro'
import type { AdminUserListResponseUsersItem } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useUsers } from '#/features/users/api/users'

export const useUserTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminUserListResponseUsersItem>({
    useData: (params) => {
      const { data, isPending, isFetching } = useUsers(params)
      return {
        data: data?.users ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('name', { header: t`Name`, sortable: true }),
      col.accessor('email', { header: t`Email` }),
      col.display('roles', {
        header: t`Roles`,
        cell: ({ row }) => (row.roles?.length ? row.roles.map((r) => r.name).join(', ') : '—'),
      }),
      col.accessor('createdAt', { header: t`Joined`, render: 'datetime' }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/settings/users/${row.id}`,

    empty: {
      heading: t`No users yet`,
      description: t`Invite someone to get started.`,
    },
    filtered: {
      heading: t`No users found`,
    },
  })
}
