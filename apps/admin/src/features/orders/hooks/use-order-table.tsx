import { useLingui } from '@lingui/react/macro'
import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminOrder } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useOrders } from '#/features/orders/api/orders'
import {
  fulfillmentStatusColors,
  fulfillmentStatusLabels,
  orderStatusColors,
  orderStatusLabels,
} from '#/features/orders/utils/order-status'

export const useOrderTable = () => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminOrder>({
    useData: (params) => {
      const { data, isPending, isFetching } = useOrders(params)
      return {
        data: data?.orders ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('displayId', {
        header: t`Order`,
        cell: ({ value }) => `#${value}`,
      }),
      col.accessor('email', { header: t`Customer` }),
      col.accessor('status', {
        header: t`Status`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={orderStatusColors[value]}>{i18n._(orderStatusLabels[value])}</StatusCell>
        ),
      }),
      col.accessor('fulfillmentStatus', {
        header: t`Fulfillment`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={fulfillmentStatusColors[value]}>{i18n._(fulfillmentStatusLabels[value])}</StatusCell>
        ),
      }),
      col.accessor('createdAt', { header: t`Date`, render: 'datetime', sortable: true }),
    ],

    filters: (filter) => [
      filter.accessor('status', {
        type: 'select',
        label: t`Status`,
        options: [
          { label: t`Pending`, value: 'pending' },
          { label: t`Completed`, value: 'completed' },
          { label: t`Canceled`, value: 'canceled' },
          { label: t`Archived`, value: 'archived' },
        ],
      }),
      filter.accessor('createdAt', {
        type: 'date',
        label: t`Date`,
        presets: [
          { label: t`Today`, value: { $gte: todayIso() } },
          { label: t`Last 7 days`, value: { $gte: daysAgoIso(7) } },
          { label: t`Last 30 days`, value: { $gte: daysAgoIso(30) } },
          { label: t`Last 12 months`, value: { $gte: daysAgoIso(365) } },
        ],
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/orders/${row.id}`,

    empty: {
      heading: t`No orders yet`,
      description: t`Orders will appear here once customers complete checkout.`,
    },
    filtered: {
      heading: t`No orders found`,
      description: t`Try changing your filters or search term.`,
    },
  })
}
