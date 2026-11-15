import { useLingui } from '@lingui/react/macro'
import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminDraftOrder } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useDraftOrders } from '#/features/draft-orders/api/draft-orders'
import { orderStatusColors, orderStatusLabels } from '#/features/orders/utils/order-status'

export const useDraftOrderTable = () => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminDraftOrder>({
    useData: (params) => {
      const { data, isPending, isFetching } = useDraftOrders(params)
      return {
        data: data?.draftOrders ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('reference', { header: t`Draft` }),
      col.accessor('email', { header: t`Customer` }),
      col.accessor('status', {
        header: t`Status`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={orderStatusColors[value]}>{i18n._(orderStatusLabels[value])}</StatusCell>
        ),
      }),
      col.accessor('createdAt', { header: t`Date`, render: 'datetime', sortable: true }),
    ],

    filters: (filter) => [
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
    rowHref: (row) => `/draft-orders/${row.id}`,

    empty: {
      heading: t`No draft orders yet`,
      description: t`Draft orders appear here when shoppers send their cart to the shop.`,
    },
    filtered: {
      heading: t`No draft orders found`,
      description: t`Try changing your filters or search term.`,
    },
  })
}
