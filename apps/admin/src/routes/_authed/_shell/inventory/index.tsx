import { AdminInventoryItemListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { inventoryItemsListQueryOptions } from '#/features/inventory/api/inventory'
import { useInventoryTable } from '#/features/inventory/hooks/use-inventory-table'

export const Route = createFileRoute('/_authed/_shell/inventory/')({
  validateSearch: AdminInventoryItemListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(inventoryItemsListQueryOptions()),
  component: InventoryPage,
})

function InventoryPage() {
  const inventory = useInventoryTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={inventory} className="flex-1" heading="Inventory" />
    </PageLayout.SingleColumn>
  )
}
