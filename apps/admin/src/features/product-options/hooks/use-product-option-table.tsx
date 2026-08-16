import type { AdminProductOption } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { OptionRowActions } from '#/features/product-options/components/option-row-actions'

export const useProductOptionTable = () =>
  useDefineTable<AdminProductOption>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProductOptions(params)
      return {
        data: data?.productOptions ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [
      col.accessor('title', { header: 'Title', sortable: true }),
      col.display('values', {
        header: 'Values',
        cell: ({ row }) => `${row.values.length} values`,
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/product-options/${row.id}`,
    rowActions: (row) => <OptionRowActions option={row} />,

    empty: {
      heading: 'No options yet',
      description: 'Create your first option (e.g. Color, Size) to get started.',
    },
    filtered: {
      heading: 'No options found',
      description: 'Try changing your search term.',
    },
  })
