import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * What was paid and when, and nothing that implies how. The order module stores no card brand
 * or last four — `transaction` records amounts, not instruments — so a "Payment method" heading
 * over a status was a lie of placement.
 */
export function PaymentDetails({ order }: { order: StoreOrderResponseOrder }) {
  const { t } = useLingui()
  const formatters = useFormatters()
  const { headline, detail } = paymentLines(order, formatters)

  return (
    <Panel title={t`Payment`}>
      <p className="mt-6 text-ink text-sm">{t(headline)}</p>
      <p className="mt-1 text-ink-muted text-sm">{t(detail)}</p>
    </Panel>
  )
}

/**
 * `paymentStatus` has three values and this panel used to render two, folding `authorized` in
 * with `awaiting`. An authorized payment is money the bank has already reserved; telling that
 * shopper their order is awaiting payment, on a page that simultaneously says it is being
 * prepared, is the page contradicting itself.
 *
 * A canceled order is read first, for the same reason: "$92,500.00 due" under a heading that
 * says the order was called off is the same contradiction wearing different words. A captured
 * payment on a canceled order still reads as captured — refunds are not modelled on this
 * response, and inventing one here would be worse than saying nothing about it.
 *
 * The date is the order's, not the payment's — the store response carries no transaction
 * timestamp — so it is only printed where the two coincide. An order still awaiting payment has
 * no moment to name, and printing the amount "on" the day it was placed would read as paid.
 */
function paymentLines(
  order: StoreOrderResponseOrder,
  { formatPrice, formatDatetime }: ReturnType<typeof useFormatters>,
): { headline: MessageDescriptor; detail: MessageDescriptor } {
  const total = formatPrice(order.totals.orderTotal, order.currencyCode)
  const paidAt = formatDatetime(order.createdAt)
  const captured = { headline: msg`Payment received`, detail: msg`${total} on ${paidAt}` }

  if (order.paymentStatus === 'captured') return captured
  if (order.status === 'canceled') return { headline: msg`No payment taken`, detail: msg`${total} was not charged` }
  if (order.paymentStatus === 'authorized') {
    return {
      headline: msg`Payment authorized`,
      detail: msg`${total} reserved by your bank, charged when your order ships`,
    }
  }
  return { headline: msg`Awaiting payment`, detail: msg`${total} due` }
}
