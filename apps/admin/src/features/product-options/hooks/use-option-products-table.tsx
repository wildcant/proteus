import { useLingui } from '@lingui/react/macro'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProductsForOption } from '#/features/product-options/api/product-options'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

export const useOptionProductsTable = (optionId: string) => {
  const { t, i18n } = useLingui()
  return useDefineTable<AdminProduct>({
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
      col.accessor('title', { header: t`Product`, sortable: true }),
      col.accessor('status', {
        header: t`Status`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={productStatusColors[value]}>{i18n._(productStatusLabels[value])}</StatusCell>
        ),
      }),
    ],

    prefix: 'op',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowHref: (row) => `/products/${row.id}`,

    empty: {
      heading: t`No products`,
      description: t`No products are using this option yet.`,
    },
    filtered: {
      heading: t`No products found`,
      description: t`Try changing your search term.`,
    },
  })
}
