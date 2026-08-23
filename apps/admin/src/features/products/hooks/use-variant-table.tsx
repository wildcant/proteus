import { Badge } from '@proteus/ui'
import type { AdminProductVariant } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table'
import { useProductOptionsForProduct } from '#/features/product-options/api/product-options'
import { useProductVariants } from '#/features/products/api/product-variants'
import { VariantRowActions } from '#/features/products/components/variant/variant-row-actions'

export const useVariantTable = (productId: string) => {
  // The product's options decide the columns; each variant's own resolved values fill the cells.
  const { data: optionsData } = useProductOptionsForProduct(productId)
  const options = optionsData?.productOptions ?? []

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
      col.accessor('title', { header: 'Title', sortable: true }),
      col.accessor('sku', { header: 'SKU' }),
      // One column per option, so the table reads as the matrix it is. The API already resolved
      // and ordered each variant's values, so this only has to find the matching one.
      ...options.map((option) =>
        col.display(option.id, {
          header: option.title,
          cell: ({ row }) => {
            const optionValue = row.optionValues.find((candidate) => candidate.optionId === option.id)
            return optionValue ? <Badge variant="secondary">{optionValue.value}</Badge> : null
          },
        }),
      ),
    ],

    filters: (filter) => [
      filter.accessor('allowBackorder', {
        type: 'radio',
        label: 'Allow Backorder',
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' },
        ],
      }),
      filter.accessor('manageInventory', {
        type: 'radio',
        label: 'Manage Inventory',
        options: [
          { label: 'Yes', value: 'true' },
          { label: 'No', value: 'false' },
        ],
      }),
    ],

    prefix: 'pv',
    pageSize: 10,
    getRowId: (row) => row.id,
    rowHref: (row) => `variants/${row.id}`,
    rowActions: (row) => <VariantRowActions productId={productId} variant={row} />,

    empty: {
      heading: 'No variants yet',
      description: 'Create your first variant to get started.',
    },
    filtered: {
      heading: 'No variants found',
      description: 'Try changing your filters or search term.',
    },
  })
}
