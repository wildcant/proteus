import { useLingui } from '@lingui/react/macro'
import type { AdminInventoryItem } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useInventoryItems } from '#/features/inventory/api/inventory'
import { useStore } from '#/features/store/api/store'

/**
 * What the shop has, one row per tracked variant. Read-only: the number is set on the variant,
 * next to its price, so there is no edit affordance anywhere here.
 *
 * Stocked and Reserved stay separate columns — units already committed to an order are not units
 * to reorder against — and the low-stock filter only appears once the store has a threshold to
 * compare against.
 */
export const useInventoryTable = () => {
  const { data: store } = useStore()
  const { t } = useLingui()
  const threshold = store?.store.lowStockThreshold
  const hasThreshold = threshold !== null && threshold !== undefined

  return useDefineTable<AdminInventoryItem>({
    useData: (params) => {
      const { data, isPending, isFetching } = useInventoryItems(params)
      return {
        data: data?.inventoryItems ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('productTitle', { header: t`Product`, sortable: true }),
      col.accessor('variantTitle', { header: t`Variant`, sortable: true }),
      col.accessor('sku', { header: t`SKU`, sortable: true, cell: ({ value }) => value ?? '—' }),
      col.accessor('stockedQuantity', { header: t`Stocked`, sortable: true, align: 'right' }),
      col.accessor('reservedQuantity', { header: t`Reserved`, sortable: true, align: 'right' }),
      col.accessor('availableQuantity', {
        header: t`Available`,
        sortable: true,
        align: 'right',
        cell: ({ value, row }) => (
          <span className={row.lowStock ? 'font-medium text-destructive' : undefined}>{value}</span>
        ),
      }),
    ],

    filters: (filter) =>
      hasThreshold
        ? [
            filter.accessor('lowStock', {
              type: 'radio',
              label: t`Stock`,
              options: [{ label: t`Low stock (${threshold} or fewer)`, value: 'true' }],
            }),
          ]
        : [],

    // The endpoint takes no `q`: these rows are scanned, sorted and filtered, never searched.
    searchable: false,

    getRowId: (row) => row.id,
    rowHref: (row) => `/products/${row.productId}/variants/${row.variantId}`,

    empty: {
      heading: t`Nothing tracked yet`,
      description: t`Inventory appears here once a product has a variant the shop tracks.`,
    },
    filtered: {
      heading: t`No inventory found`,
      description: t`Try changing your filters.`,
    },
  })
}
