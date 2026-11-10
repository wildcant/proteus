import { useLingui } from '@lingui/react/macro'
import type { AdminProductType } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProductTypes } from '#/features/product-types/api/product-types'

export const useProductTypeTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminProductType>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProductTypes(params)
      return { data: data?.types ?? [], count: data?.count, isPending, isFetching }
    },

    columns: (col) => [col.accessor('value', { header: t`Value`, sortable: true })],

    getRowId: (row) => row.id,
    rowHref: (row) => `/product-types/${row.id}`,

    empty: {
      heading: t`No types yet`,
      description: t`Create a type to name what a product is, such as T-shirt or Sneakers.`,
    },
    filtered: { heading: t`No types found`, description: t`Try changing your search term.` },
  })
}
