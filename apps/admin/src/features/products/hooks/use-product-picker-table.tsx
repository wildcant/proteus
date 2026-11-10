import { useLingui } from '@lingui/react/macro'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProducts } from '#/features/products/api/products'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

/**
 * Every product, searchable, with a checkbox per row. Selection is held by the caller as the whole
 * set of ids, so it survives paging and search. Nothing is ever disabled: a current member is
 * simply pre-checked, and unchecking it is how it is removed.
 */
export const useProductPickerTable = (selectedIds: string[], onSelectedIdsChange: (ids: string[]) => void) => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProducts(params)
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

    // The picker opens over a page that lists products of its own.
    prefix: 'pp',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowSelection: () => ({
      value: Object.fromEntries(selectedIds.map((id) => [id, true])),
      onChange: (next) => onSelectedIdsChange(Object.keys(next).filter((id) => next[id])),
    }),

    empty: { heading: t`No products yet`, description: t`Create a product to add it here.` },
    filtered: { heading: t`No products found`, description: t`Try changing your search term.` },
  })
}
