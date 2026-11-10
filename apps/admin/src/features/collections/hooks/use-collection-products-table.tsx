import { useLingui } from '@lingui/react/macro'
import type { AdminProduct } from '#/api/generated/model'
import { StatusCell } from '#/components/data-table/data-table-ui/status-cell'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { CollectionProductRowActions } from '#/features/collections/components/collection-product-row-actions'
import { useProducts } from '#/features/products/api/products'
import { productStatusColors, productStatusLabels } from '#/features/products/utils/product-status'

export const useCollectionProductsTable = (collectionId: string) => {
  const { t, i18n } = useLingui()

  return useDefineTable<AdminProduct>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProducts({ ...params, collectionId })
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

    prefix: 'colp',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowHref: (row) => `/products/${row.id}`,
    rowActions: (row) => <CollectionProductRowActions collectionId={collectionId} product={row} />,

    empty: { heading: t`No products`, description: t`Add products to list them in this collection.` },
    filtered: { heading: t`No products found`, description: t`Try changing your search term.` },
  })
}
