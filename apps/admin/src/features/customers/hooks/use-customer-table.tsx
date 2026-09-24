import { useLingui } from '@lingui/react/macro'
import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminCustomer } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useCustomers } from '#/features/customers/api/customers'
import { CustomerRowActions } from '#/features/customers/components/customer-row-actions'
import { customerName } from '#/features/customers/utils/customer-name'

export const useCustomerTable = () => {
  const { t } = useLingui()

  return useDefineTable<AdminCustomer>({
    useData: (params) => {
      const { data, isPending, isFetching } = useCustomers(params)
      return {
        data: data?.customers ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      // AdminCustomer holds the two halves separately, so there is no accessor to sort on here.
      col.display('name', { header: t`Name`, cell: ({ row }) => customerName(row) || '—' }),
      col.accessor('email', { header: t`Email`, sortable: true }),
      col.accessor('hasAccount', {
        header: t`Account`,
        cell: ({ value }) => (value ? t`Registered` : t`Guest`),
      }),
      col.accessor('createdAt', { header: t`Created`, render: 'datetime', sortable: true }),
    ],

    filters: (filter) => [
      filter.accessor('createdAt', {
        type: 'date',
        label: t`Created`,
        presets: [
          { label: t`Today`, value: { $gte: todayIso() } },
          { label: t`Last 7 days`, value: { $gte: daysAgoIso(7) } },
          { label: t`Last 30 days`, value: { $gte: daysAgoIso(30) } },
          { label: t`Last 12 months`, value: { $gte: daysAgoIso(365) } },
        ],
      }),
    ],

    getRowId: (row) => row.id,
    rowActions: (row) => <CustomerRowActions customer={row} />,

    empty: {
      heading: t`No customers yet`,
      description: t`Create your first customer to get started.`,
    },
    filtered: {
      heading: t`No customers found`,
      description: t`Try changing your filters or search term.`,
    },
  })
}
