import { useLingui } from '@lingui/react/macro'
import { AdminCustomerListParams } from '@proteus/http-schemas/admin'
import { createFileRoute } from '@tanstack/react-router'
import { DataTable } from '#/components/data-table/data-table'
import { PageLayout } from '#/components/layout/page-layout'
import { customersListQueryOptions } from '#/features/customers/api/customers'
import { useCustomerTable } from '#/features/customers/hooks/use-customer-table'

export const Route = createFileRoute('/_authed/_shell/customers/')({
  validateSearch: AdminCustomerListParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(customersListQueryOptions()),
  component: CustomersPage,
})

function CustomersPage() {
  const { t } = useLingui()
  const customers = useCustomerTable()

  return (
    <PageLayout.SingleColumn>
      <DataTable use={customers} className="flex-1" heading={t`Customers`} />
    </PageLayout.SingleColumn>
  )
}
