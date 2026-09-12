import type { AdminUser } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useUsers } from '#/features/users/api/users'

export const useUserTable = () =>
  useDefineTable<AdminUser>({
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
      col.accessor('name', { header: 'Name', sortable: true }),
      col.accessor('email', { header: 'Email' }),
      col.accessor('createdAt', { header: 'Joined', render: 'datetime' }),
    ],

    getRowId: (row) => row.id,

    empty: {
      heading: 'No users yet',
      description: 'Invite someone to get started.',
    },
    filtered: {
      heading: 'No users found',
    },
  })
