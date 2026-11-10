import { useLingui } from '@lingui/react/macro'
import { AdminProductTypeListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { productTypesListQueryOptions } from '#/features/product-types/api/product-types'
import { useProductTypeTable } from '#/features/product-types/hooks/use-product-type-table'

export const Route = createFileRoute('/_authed/_shell/product-types/')({
  validateSearch: AdminProductTypeListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(productTypesListQueryOptions()),
  component: ProductTypesPage,
})

function ProductTypesPage() {
  const { t } = useLingui()
  const types = useProductTypeTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={types} className="flex-1" heading={t`Types`} actions={[{ label: t`Create`, to: 'create' }]} />
    </PageLayout.SingleColumn>
  )
}
