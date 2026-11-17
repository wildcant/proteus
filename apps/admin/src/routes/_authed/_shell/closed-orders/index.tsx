import { useLingui } from '@lingui/react/macro'
import { AdminOrderListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { ordersListQueryOptions } from '#/features/orders/api/orders'
import { CLOSED_ORDER_STATUSES, useOrderTable } from '#/features/orders/hooks/use-order-table'

export const Route = createFileRoute('/_authed/_shell/closed-orders/')({
  validateSearch: AdminOrderListParams,
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(ordersListQueryOptions({ status: CLOSED_ORDER_STATUSES })),
  component: ClosedOrdersPage,
})

function ClosedOrdersPage() {
  const { t } = useLingui()
  const orders = useOrderTable(CLOSED_ORDER_STATUSES)

  return (
    <PageLayout.SingleColumn>
      <DataTable use={orders} className="flex-1" heading={t`Closed orders`} />
    </PageLayout.SingleColumn>
  )
}
