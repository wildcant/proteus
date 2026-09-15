import type { AdminReservation } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useReservations } from '#/features/inventory/api/inventory'

/**
 * Where the missing units went: every reservation the shop is holding and the order behind it.
 * Read-only — checkout writes a reservation and cancelling or fulfilling releases it.
 */
export const useReservationTable = () =>
  useDefineTable<AdminReservation>({
    useData: (params) => {
      const { data, isPending, isFetching } = useReservations(params)
      return {
        data: data?.reservations ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('orderDisplayId', {
        header: 'Order',
        cell: ({ value }) => (value === null ? '—' : `#${value}`),
      }),
      col.accessor('productTitle', { header: 'Product', cell: ({ value }) => value ?? '—' }),
      col.accessor('variantTitle', { header: 'Variant', cell: ({ value }) => value ?? '—' }),
      col.accessor('sku', { header: 'SKU', cell: ({ value }) => value ?? '—' }),
      col.accessor('quantity', { header: 'Reserved', align: 'right' }),
      col.accessor('createdAt', { header: 'Date', render: 'datetime', sortable: true }),
    ],

    // The endpoint takes no `q`: these rows are scanned, sorted and filtered, never searched.
    searchable: false,

    getRowId: (row) => row.id,
    // A reservation whose line item is gone has no order to open, so its row stays unclickable.
    rowHref: (row) => (row.orderId ? `/orders/${row.orderId}` : ''),

    empty: {
      heading: 'No reservations',
      description: 'Placing an order holds its stock, and the hold shows up here.',
    },
    filtered: {
      heading: 'No reservations found',
      description: 'Try changing your filters.',
    },
  })
