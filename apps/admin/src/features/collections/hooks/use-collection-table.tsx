import { useLingui } from '@lingui/react/macro'
import type { AdminProductCollection } from '#/api/generated/model'
import { useDefineTable } from '#/components/data-table/hooks/use-define-table'
import { useCollections } from '#/features/collections/api/collections'

export const useCollectionTable = () => {
  const { t } = useLingui()
  return useDefineTable<AdminProductCollection>({
    useData: (params) => {
      const { data, isPending, isFetching } = useCollections(params)
      return { data: data?.collections ?? [], count: data?.count, isPending, isFetching }
    },

    columns: (col) => [
      col.accessor('thumbnail', { header: '', render: 'thumbnail', truncateTooltip: false, size: 56 }),
      col.accessor('title', { header: t`Title`, sortable: true }),
      col.accessor('handle', { header: t`Handle`, sortable: true }),
    ],

    getRowId: (row) => row.id,
    rowHref: (row) => `/collections/${row.id}`,

    empty: {
      heading: t`No collections yet`,
      description: t`Create a collection to group products for a campaign or a season.`,
    },
    filtered: { heading: t`No collections found`, description: t`Try changing your search term.` },
  })
}
