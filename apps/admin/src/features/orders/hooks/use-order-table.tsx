import { useLingui } from '@lingui/react/macro'
import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminOrder, ListOrdersParams } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useOrders } from '#/features/orders/api/orders'
import {
  fulfillmentStatusColors,
  fulfillmentStatusLabels,
  orderStatusColors,
  orderStatusLabels,
} from '#/features/orders/utils/order-status'

type OrderStatus = NonNullable<AdminOrder['status']>

/** Orders the shop still has to act on, on the main page. */
export const OPEN_ORDER_STATUSES: OrderStatus[] = ['pending']
/** Orders in an end state, on a page of their own so they stay out of the way. */
export const CLOSED_ORDER_STATUSES: OrderStatus[] = ['completed', 'canceled', 'archived']

/** The orders table, scoped to `statuses`; a status filter narrows within them. */
export const useOrderTable = (statuses: OrderStatus[]) => {
  const { t, i18n } = useLingui()

  const statusOptions = [
    { label: t`Pending`, value: 'pending' },
    { label: t`Completed`, value: 'completed' },
    { label: t`Canceled`, value: 'canceled' },
    { label: t`Archived`, value: 'archived' },
  ].filter((option) => statuses.includes(option.value as OrderStatus))

  return useDefineTable<AdminOrder>({
    useData: (params: ListOrdersParams) => {
      const { data, isPending, isFetching } = useOrders({ ...params, status: params.status ?? statuses })
      return {
        data: data?.orders ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('reference', { header: t`Order` }),
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
      // One status has nothing to filter between.
      ...(statusOptions.length > 1
        ? [filter.accessor('status', { type: 'select', label: t`Status`, options: statusOptions })]
        : []),
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
