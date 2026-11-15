import { Trans, useLingui } from '@lingui/react/macro'
import { Card, CardHeader, CardTitle } from '@proteus/ui'
import type { AdminOrderResponseOrder } from '#/api/generated/model'
import { SectionRow } from '#/components/common/section-row'
import { useCustomer } from '#/features/customers/api/customers'
import { customerName } from '#/features/customers/utils/customer-name'

/** The Customer the Order belongs to: a shopper's account, or the guest made for them at checkout or at conversion. */
export function OrderCustomerSection({ order }: { order: AdminOrderResponseOrder }) {
  const { t } = useLingui()
  const { data } = useCustomer(order.customerId)
  const customer = data?.customer

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>
          <Trans>Customer</Trans>
        </CardTitle>
      </CardHeader>
      {customer ? (
        <>
          <SectionRow title={t`Name`} value={customerName(customer) || null} />
          <SectionRow title={t`Phone`} value={customer.phone} />
          <SectionRow title={t`Account`} value={customer.hasAccount ? t`Registered` : t`Guest`} />
        </>
      ) : null}
      <SectionRow title={t`Email`} value={order.email} />
      <SectionRow title={t`Currency`} value={order.currencyCode.toUpperCase()} />
    </Card>
  )
}
