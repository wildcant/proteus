import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'
import { useFormatters } from '#/lib/use-formatters'

/**
 * What was paid and when, and nothing that implies how. The order module stores no card brand
 * or last four — `transaction` records amounts, not instruments — so a "Payment method" heading
 * over a status was a lie of placement.
 */
export function PaymentDetails({ order }: { order: StoreOrderResponseOrder }) {
  const formatters = useFormatters()
  const { headline, detail } = paymentLines(order, formatters)

  return (
    <Panel title="Payment">
      <p className="mt-6 text-ink text-sm">{headline}</p>
      <p className="mt-1 text-ink-muted text-sm">{detail}</p>
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
): { headline: string; detail: string } {
  const total = formatPrice(order.totals.orderTotal, order.currencyCode)
  const captured = { headline: 'Payment received', detail: `${total} on ${formatDatetime(order.createdAt)}` }

  if (order.paymentStatus === 'captured') return captured
  if (order.status === 'canceled') return { headline: 'No payment taken', detail: `${total} was not charged` }
  if (order.paymentStatus === 'authorized') {
    return { headline: 'Payment authorized', detail: `${total} reserved by your bank, charged when your order ships` }
  }
  return { headline: 'Awaiting payment', detail: `${total} due` }
}
