import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminCustomer } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useCustomers } from '#/features/customers/api/customers'
import { CustomerRowActions } from '#/features/customers/components/customer-row-actions'
import { customerName } from '#/features/customers/utils/customer-name'

export const useCustomerTable = () =>
  useDefineTable<AdminCustomer>({
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
      col.display('name', { header: 'Name', cell: ({ row }) => customerName(row) || '—' }),
      col.accessor('email', { header: 'Email', sortable: true }),
      col.accessor('hasAccount', {
        header: 'Account',
        cell: ({ value }) => (value ? 'Registered' : 'Guest'),
      }),
      col.accessor('createdAt', { header: 'Created', render: 'datetime', sortable: true }),
    ],

    filters: (filter) => [
      filter.accessor('createdAt', {
        type: 'date',
        label: 'Created',
        presets: [
          { label: 'Today', value: { $gte: todayIso() } },
          { label: 'Last 7 days', value: { $gte: daysAgoIso(7) } },
          { label: 'Last 30 days', value: { $gte: daysAgoIso(30) } },
          { label: 'Last 12 months', value: { $gte: daysAgoIso(365) } },
        ],
      }),
    ],

    getRowId: (row) => row.id,
    rowActions: (row) => <CustomerRowActions customer={row} />,

    empty: {
      heading: 'No customers yet',
      description: 'Create your first customer to get started.',
    },
    filtered: {
      heading: 'No customers found',
      description: 'Try changing your filters or search term.',
    },
  })
