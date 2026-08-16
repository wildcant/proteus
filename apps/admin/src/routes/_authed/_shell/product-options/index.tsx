import { AdminProductOptionListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { productOptionsListQueryOptions } from '#/features/product-options/api/product-options'
import { useProductOptionTable } from '#/features/product-options/hooks/use-product-option-table'

export const Route = createFileRoute('/_authed/_shell/product-options/')({
  validateSearch: AdminProductOptionListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(productOptionsListQueryOptions()),
  component: ProductOptionsPage,
})

function ProductOptionsPage() {
  const productOptions = useProductOptionTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={productOptions}
        className="flex-1"
        heading="Options"
        actions={[{ label: 'Create', to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
