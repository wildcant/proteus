import { useLingui } from '@lingui/react/macro'
import { AdminProductCollectionListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { collectionsListQueryOptions } from '#/features/collections/api/collections'
import { useCollectionTable } from '#/features/collections/hooks/use-collection-table'

export const Route = createFileRoute('/_authed/_shell/collections/')({
  validateSearch: AdminProductCollectionListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(collectionsListQueryOptions()),
  component: CollectionsPage,
})

function CollectionsPage() {
  const { t } = useLingui()
  const collections = useCollectionTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={collections}
        className="flex-1"
        heading={t`Collections`}
        actions={[{ label: t`Create`, to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
