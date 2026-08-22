import { daysAgoIso, todayIso } from '@proteus/utils'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell, useDefineTable } from '#/components/data-table'
import { useProducts } from '#/features/products/api/products'
import { ProductRowActions } from '#/features/products/components/product-row-actions'
import { productStatusColors } from '#/features/products/constants'

export const useProductTable = () =>
  useDefineTable<AdminProduct>({
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
      col.accessor('title', { header: 'Title', sortable: true }),
      col.accessor('handle', { header: 'Handle' }),
      col.accessor('status', {
        header: 'Status',
        truncateTooltip: false,
        cell: ({ value }) => <StatusCell color={productStatusColors[value]}>{value}</StatusCell>,
      }),
    ],

    filters: (filter) => [
      filter.accessor('status', {
        type: 'select',
        label: 'Status',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' },
          { label: 'Proposed', value: 'proposed' },
          { label: 'Rejected', value: 'rejected' },
        ],
      }),
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
    rowHref: (row) => `/products/${row.id}`,
    rowActions: (row) => <ProductRowActions product={row} />,

    empty: {
      heading: 'No products yet',
      description: 'Create your first product to get started.',
    },
    filtered: {
      heading: 'No products found',
      description: 'Try changing your filters or search term.',
    },
  })
