import { useLingui } from '@lingui/react/macro'
import type { AdminProductOption } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProductOptions } from '#/features/product-options/api/product-options'
import { OptionRowActions } from '#/features/product-options/components/option-row-actions'

export const useProductOptionTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminProductOption>({
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
      col.accessor('title', { header: t`Title`, sortable: true }),
      col.display('values', {
        header: t`Values`,
        cell: ({ row }) => {
          const count = row.values.length
          return t`${count} values`
        },
      }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/product-options/${row.id}`,
    rowActions: (row) => <OptionRowActions option={row} />,

    empty: {
      heading: t`No options yet`,
      description: t`Create your first option (e.g. Color, Size) to get started.`,
    },
    filtered: {
      heading: t`No options found`,
      description: t`Try changing your search term.`,
    },
  })
}
