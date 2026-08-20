import { AdminOrderListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { ordersListQueryOptions } from '#/features/orders/api/orders'
import { useOrderTable } from '#/features/orders/hooks/use-order-table'

export const Route = createFileRoute('/_authed/_shell/orders/')({
  validateSearch: AdminOrderListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(ordersListQueryOptions()),
  component: OrdersPage,
})

function OrdersPage() {
  const orders = useOrderTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={orders} className="flex-1" heading="Orders" />
    </PageLayout.SingleColumn>
  )
}
