import { Badge } from '@proteus/ui'
import type { AdminProduct } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table'
import { useProductsForOption } from '#/features/product-options/api/product-options'
import { productStatusBadgeVariants } from '#/features/products/constants'

export const useOptionProductsTable = (optionId: string) =>
  useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProductsForOption(optionId, params)
      return {
        data: data?.products ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('title', { header: 'Product', sortable: true }),
      col.accessor('status', {
        header: 'Status',
        truncateTooltip: false,
        cell: ({ value }) => <Badge variant={productStatusBadgeVariants[value] ?? 'secondary'}>{value}</Badge>,
      }),
    ],

    prefix: 'op',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowHref: (row) => `/products/${row.id}`,

    empty: {
      heading: 'No products',
      description: 'No products are using this option yet.',
    },
    filtered: {
      heading: 'No products found',
      description: 'Try changing your search term.',
    },
  })
