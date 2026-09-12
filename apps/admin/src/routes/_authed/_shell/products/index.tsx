import { AdminProductListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { productsListQueryOptions } from '#/features/products/api/products'
import { useProductTable } from '#/features/products/hooks/use-product-table'

export const Route = createFileRoute('/_authed/_shell/products/')({
  validateSearch: AdminProductListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(productsListQueryOptions()),
  component: ProductsPage,
})

function ProductsPage() {
  const products = useProductTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable
        use={products}
        className="flex-1"
        heading="Products"
        actions={[{ label: 'Create Product', to: 'create' }]}
      />
    </PageLayout.SingleColumn>
  )
}
