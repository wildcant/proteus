import type { AdminProductOption, AdminProductOptionValue } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table'
import { useValuesForOption } from '#/features/product-options/api/product-options'
import { ValueRowActions } from '#/features/product-options/components/value-row-actions'

export const useOptionValuesTable = (option: AdminProductOption) =>
  useDefineTable<AdminProductOptionValue>({
    useData: (params) => {
      const { data, isPending, isFetching } = useValuesForOption(option.id, params)
      return {
        data: data?.values ?? [],
        count: data?.count,
        isPending,
        isFetching,
      }
    },

    columns: (col) => [col.accessor('value', { header: 'Values' })],

    prefix: 'ov',
    pageSize: 20,
    getRowId: (row) => row.id,
    rowActions: (row) => <ValueRowActions option={option} value={row} />,

    empty: {
      heading: 'No values',
      description: 'Add values to this option using the edit form.',
    },
    filtered: {
      heading: 'No values found',
      description: 'Try changing your search term.',
    },
  })
