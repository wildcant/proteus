import { useLingui } from '@lingui/react/macro'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProducts } from '#/features/products/api/products'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

/** Read-only: a product's Tags are set from the product. */
export const useProductTagProductsTable = (tagId: string) => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProducts({ ...params, tagId })
      return { data: data?.products ?? [], count: data?.count, isPending, isFetching }
    },

    columns: (col) => [
      col.accessor('thumbnail', { header: '', render: 'thumbnail', truncateTooltip: false, size: 56 }),
      col.accessor('title', { header: t`Title`, sortable: true }),
      col.accessor('status', {
        header: t`Status`,
        truncateTooltip: false,
        cell: ({ value }) => (
          <StatusCell color={productStatusColors[value]}>{i18n._(productStatusLabels[value])}</StatusCell>
        ),
      }),
    ],

    prefix: 'tagp',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowHref: (row) => `/products/${row.id}`,

    empty: { heading: t`No products`, description: t`Add this tag to a product to list it here.` },
    filtered: { heading: t`No products found`, description: t`Try changing your search term.` },
  })
}
