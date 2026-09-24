import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardHeader, CardTitle } from '@proteus/ui'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { SectionRow } from '#/components/common/section-row'

export function OrderCustomerSection({ order }: { order: AdminOrderResponseOrder }) {
  const { t } = useLingui()
  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Customer</Trans>
        </CardTitle>
      </CardHeader>
      <SectionRow title={t`Email`} value={order.email} />
      <SectionRow title={t`Customer ID`} value={order.customerId} />
      <SectionRow title={t`Currency`} value={order.currencyCode.toUpperCase()} />
    </Card>
  )
}
