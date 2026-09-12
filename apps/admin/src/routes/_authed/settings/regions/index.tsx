import { AdminRegionListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { regionsListQueryOptions } from '#/features/regions/api/regions'
import { useRegionTable } from '#/features/regions/hooks/use-region-table'

export const Route = createFileRoute('/_authed/settings/regions/')({
  validateSearch: AdminRegionListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(regionsListQueryOptions()),
  component: RegionsPage,
})

function RegionsPage() {
  const regions = useRegionTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={regions}
        className="flex-1"
        heading="Regions"
        description="A region is an area that you sell products in. It can cover multiple countries, and has different providers and currency."
        actions={[{ label: 'Create', to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
