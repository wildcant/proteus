import { useLingui } from '@lingui/react/macro'
import type { AdminProductVariant } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProductVariants } from '#/features/products/api/product-variants'

/**
 * The product's variants, for picking which of them use a given image.
 *
 * `imageUrl` drives the read-only Thumbnail column, so it has to be part of the definition
 * rather than captured once.
 */
export const useImageVariantsTable = (
  productId: string,
  imageUrl: string,
  selectedIds: string[],
  onSelectedIdsChange: (ids: string[]) => void,
) => {
  const { t } = useLingui()

  return useDefineTable<AdminProductVariant>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProductVariants(productId, params)
      return {
        data: data?.variants ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('title', { header: t`Title`, sortable: true }),
      col.accessor('sku', { header: t`SKU` }),
      col.accessor('thumbnail', {
        header: t`Thumbnail`,
        cell: ({ value }) => (value === imageUrl ? t`True` : t`False`),
      }),
    ],

    // Must differ from the detail page's `pv` — that table stays mounted under the drawer.
    prefix: 'iv',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowSelection: () => ({
      value: Object.fromEntries(selectedIds.map((id) => [id, true])),
      onChange: (next) => onSelectedIdsChange(Object.keys(next).filter((id) => next[id])),
    }),

    empty: { heading: t`No variants yet` },
    filtered: { heading: t`No variants found`, description: t`Try changing your search term.` },
  })
}
