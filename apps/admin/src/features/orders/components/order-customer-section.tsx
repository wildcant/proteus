import { Card, CardHeader, CardTitle } from '@proteus/ui'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { SectionRow } from '#/components/common/section-row'

export function OrderCustomerSection({ order }: { order: AdminOrderResponseOrder }) {
  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Customer</CardTitle>
      </CardHeader>
      <SectionRow title="Email" value={order.email} />
      <SectionRow title="Customer ID" value={order.customerId} />
      <SectionRow title="Currency" value={order.currencyCode.toUpperCase()} />
    </Card>
  )
}
