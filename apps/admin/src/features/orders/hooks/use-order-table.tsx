import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminOrder } from '#/api/generated/model'
import { StatusCell, useDefineTable } from '#/components/data-table'
import { useOrders } from '#/features/orders/api/orders'
import { fulfillmentStatusColors, orderStatusColors } from '#/features/orders/constants'

export const useOrderTable = () =>
  useDefineTable<AdminOrder>({
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
        header: 'Order',
        cell: ({ value }) => `#${value}`,
      }),
      col.accessor('email', { header: 'Customer' }),
      col.accessor('status', {
        header: 'Status',
        truncateTooltip: false,
        cell: ({ value }) => <StatusCell color={orderStatusColors[value]}>{value}</StatusCell>,
      }),
      col.accessor('fulfillmentStatus', {
        header: 'Fulfillment',
        truncateTooltip: false,
        cell: ({ value }) => <StatusCell color={fulfillmentStatusColors[value]}>{value}</StatusCell>,
      }),
      col.accessor('createdAt', { header: 'Date', render: 'datetime', sortable: true }),
    ],

    filters: (filter) => [
      filter.accessor('status', {
        type: 'select',
        label: 'Status',
        options: [
          { label: 'Pending', value: 'pending' },
          { label: 'Completed', value: 'completed' },
          { label: 'Canceled', value: 'canceled' },
          { label: 'Archived', value: 'archived' },
        ],
      }),
      filter.accessor('fulfillmentStatus', {
        type: 'select',
        label: 'Fulfillment',
        options: [
          { label: 'Unfulfilled', value: 'unfulfilled' },
          { label: 'Fulfilled', value: 'fulfilled' },
          { label: 'Shipped', value: 'shipped' },
          { label: 'Delivered', value: 'delivered' },
        ],
      }),
      filter.accessor('createdAt', {
        type: 'date',
        label: 'Date',
        presets: [
          { label: 'Today', value: { $gte: todayIso() } },
          { label: 'Last 7 days', value: { $gte: daysAgoIso(7) } },
          { label: 'Last 30 days', value: { $gte: daysAgoIso(30) } },
          { label: 'Last 12 months', value: { $gte: daysAgoIso(365) } },
        ],
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/orders/${row.id}`,

    empty: {
      heading: 'No orders yet',
      description: 'Orders will appear here once customers complete checkout.',
    },
    filtered: {
      heading: 'No orders found',
      description: 'Try changing your filters or search term.',
    },
  })
