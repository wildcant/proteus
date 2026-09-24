import { useLingui } from '@lingui/react/macro'
import { Badge } from '@proteus/ui'
import type { AdminInvite } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useInvites } from '#/features/users/api/invites'
import { InviteRowActions } from '#/features/users/components/invite-row-actions'

export const useInviteTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminInvite>({
    useData: (params) => {
      const { data, isPending, isFetching } = useInvites(params)
      return {
        data: data?.invites ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('email', { header: t`Email` }),
      col.display('status', {
        header: t`Status`,
        cell: ({ row: invite }) => {
          if (invite.accepted) return <Badge variant="default">{t`Accepted`}</Badge>
          if (new Date(invite.expiresAt) < new Date()) return <Badge variant="destructive">{t`Expired`}</Badge>
          return <Badge variant="secondary">{t`Pending`}</Badge>
        },
      }),
      col.accessor('expiresAt', { header: t`Expires`, render: 'datetime' }),
    ],

    getRowId: (row) => row.id,
    rowActions: (row) => <InviteRowActions invite={row} />,

    empty: {
      heading: t`No pending invites`,
    },
    filtered: {
      heading: t`No invites found`,
    },
  })
}
