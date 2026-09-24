import { useLingui } from '@lingui/react/macro'
import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProducts } from '#/features/products/api/products'
import { ProductRowActions } from '#/features/products/components/product-row-actions'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

export const useProductTable = () => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProducts(params)
      return {
        data: data?.products ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      // The table is `table-fixed` and wraps cells in TruncatedCell, so an image column needs an
      // explicit size and has to opt out of truncation.
      col.accessor('thumbnail', { header: '', render: 'thumbnail', truncateTooltip: false, size: 56 }),
      col.accessor('title', { header: t`Title`, sortable: true }),
      col.accessor('handle', { header: t`Handle` }),
      col.accessor('status', {
        header: t`Status`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={productStatusColors[value]}>{i18n._(productStatusLabels[value])}</StatusCell>
        ),
      }),
    ],

    filters: (filter) => [
      filter.accessor('status', {
        type: 'select',
        label: t`Status`,
        options: [
          { label: t`Draft`, value: 'draft' },
          { label: t`Published`, value: 'published' },
          { label: t`Proposed`, value: 'proposed' },
          { label: t`Rejected`, value: 'rejected' },
        ],
      }),
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
    rowHref: (row) => `/products/${row.id}`,
    rowActions: (row) => <ProductRowActions product={row} />,

    empty: {
      heading: t`No products yet`,
      description: t`Create your first product to get started.`,
    },
    filtered: {
      heading: t`No products found`,
      description: t`Try changing your filters or search term.`,
    },
  })
}
