import { useLingui } from '@lingui/react/macro'
import { AdminProductTagListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { productTagsListQueryOptions } from '#/features/product-tags/api/product-tags'
import { useProductTagTable } from '#/features/product-tags/hooks/use-product-tag-table'

export const Route = createFileRoute('/_authed/_shell/product-tags/')({
  validateSearch: AdminProductTagListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(productTagsListQueryOptions()),
  component: ProductTagsPage,
})

function ProductTagsPage() {
  const { t } = useLingui()
  const tags = useProductTagTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={tags} className="flex-1" heading={t`Tags`} actions={[{ label: t`Create`, to: 'create' }]} />
    </PageLayout.SingleColumn>
  )
}
