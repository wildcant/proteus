import { useLingui } from '@lingui/react/macro'
import type { AdminProduct, ListProductsParams } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import type { TableConfig } from '#/components/data-table/types'
import { useProducts } from '#/features/products/api/products'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

/** Narrows the list to one grouping's products; empty for every product. */
export type ProductListFilter = Pick<ListProductsParams, 'categoryId' | 'collectionId' | 'typeId' | 'tagId'>

type ProductListTableConfig = Pick<
  TableConfig<AdminProduct>,
  'prefix' | 'rowHref' | 'rowActions' | 'rowSelection' | 'empty'
>

/**
 * A compact product list — thumbnail, title, status — for the tables that sit inside another page:
 * a grouping's products, and the product picker opened over it.
 */
export const useProductListTable = (filter: ProductListFilter, config: ProductListTableConfig) => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProducts({ ...params, ...filter })
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

    pageSize: 10,
    getRowId: (row) => row.id,
    filtered: { heading: t`No products found`, description: t`Try changing your search term.` },
    ...config,
  })
}
