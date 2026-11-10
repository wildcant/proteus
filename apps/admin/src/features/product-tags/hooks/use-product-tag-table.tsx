import { useLingui } from '@lingui/react/macro'
import type { AdminProductTag } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useProductTags } from '#/features/product-tags/api/product-tags'

export const useProductTagTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminProductTag>({
    useData: (params) => {
      const { data, isPending, isFetching } = useProductTags(params)
      return { data: data?.tags ?? [], count: data?.count, isPending, isFetching }
    },

    columns: (col) => [col.accessor('value', { header: t`Value`, sortable: true })],

    getRowId: (row) => row.id,
    rowHref: (row) => `/product-tags/${row.id}`,

    empty: {
      heading: t`No tags yet`,
      description: t`Create a tag to let shoppers filter products by a keyword, such as organic-cotton.`,
    },
    filtered: { heading: t`No tags found`, description: t`Try changing your search term.` },
  })
}
