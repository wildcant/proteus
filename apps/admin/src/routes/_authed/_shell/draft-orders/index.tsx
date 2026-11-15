import { useLingui } from '@lingui/react/macro'
import { AdminDraftOrderListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { draftOrdersListQueryOptions } from '#/features/draft-orders/api/draft-orders'
import { useDraftOrderTable } from '#/features/draft-orders/hooks/use-draft-order-table'

export const Route = createFileRoute('/_authed/_shell/draft-orders/')({
  validateSearch: AdminDraftOrderListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(draftOrdersListQueryOptions()),
  component: DraftOrdersPage,
})

function DraftOrdersPage() {
  const { t } = useLingui()
  const draftOrders = useDraftOrderTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={draftOrders} className="flex-1" heading={t`Draft orders`} />
    </PageLayout.SingleColumn>
  )
}
