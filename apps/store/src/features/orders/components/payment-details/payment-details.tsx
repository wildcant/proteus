import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { OrderPaymentStatus, StoreOrderDetail } from '#/api/generated/model'
import { Panel } from '#/components/store/panel/panel'
import {
  paymentDetails,
  paymentDetailsDetail,
  paymentDetailsHeadline,
  paymentDetailsPanel,
  paymentDetailsStatus,
} from '#/features/orders/components/payment-details/payment-details.variants'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * What was paid and what is still owed, and nothing that implies how. The order module stores no
 * card brand or last four — its transactions record amounts, not instruments — so a "Payment
 * method" heading over a status was a lie of placement.
 */
export function PaymentDetails({ order, className }: { order: StoreOrderDetail; className?: string }) {
  const { t } = useLingui()
  const { formatPrice } = useFormatters()
  const { headline, details } = paymentLines(order, formatPrice)

  return (
    <Panel title={t`Payment`} className={cn(paymentDetails(), paymentDetailsPanel(), className)}>
      <div className={paymentDetailsStatus()}>
        <p className={paymentDetailsHeadline()}>{t(headline)}</p>
        {details.map((detail) => (
          <p key={detail.id} className={paymentDetailsDetail()}>
            {t(detail)}
          </p>
        ))}
      </div>
    </Panel>
  )
}

function headlineFor(status: OrderPaymentStatus): MessageDescriptor {
  switch (status) {
    case 'authorized':
    case 'partially_authorized':
      return msg`Payment authorized`
    case 'partially_captured':
      return msg`Partly paid`
    case 'captured':
      return msg`Payment received`
    case 'partially_refunded':
      return msg`Partly refunded`
    case 'refunded':
      return msg`Payment refunded`
    default:
      return msg`Awaiting payment`
  }
}

/**
 * The headline names the payment status; the lines under it are the response's Paid Total and
 * Outstanding Amount, so a shopper who paid a deposit sees what they paid and what they still owe
 * rather than the whole total due.
 *
 * A canceled order is read first. With nothing paid, "$92,500.00 due" under a heading that says the
 * order was called off would contradict it, so it says nothing was charged. With money kept, it
 * prints what was paid and no amount due: a canceled order owes nothing.
 *
 * An authorization with nothing captured is money the bank has reserved, not money owed, so it
 * says that instead of "due".
 */
function paymentLines(
  order: StoreOrderDetail,
  formatPrice: ReturnType<typeof useFormatters>['formatPrice'],
): { headline: MessageDescriptor; details: MessageDescriptor[] } {
  const { orderTotal, paidTotal, outstandingTotal } = order.totals
  const total = formatPrice(orderTotal, order.currencyCode)
  const paid = formatPrice(paidTotal, order.currencyCode)
  const outstanding = formatPrice(outstandingTotal, order.currencyCode)
  const hasPaid = Number(paidTotal) > 0
  const isCanceled = order.status === 'canceled'

  if (isCanceled && !hasPaid && order.paymentStatus !== 'refunded') {
    return { headline: msg`No payment taken`, details: [msg`${total} was not charged`] }
  }
  if (order.paymentStatus === 'authorized') {
    return {
      headline: headlineFor(order.paymentStatus),
      details: [msg`${total} reserved by your bank, charged when your order ships`],
    }
  }

  const details: MessageDescriptor[] = []
  if (hasPaid) details.push(msg`${paid} paid`)
  if (!isCanceled && Number(outstandingTotal) > 0) details.push(msg`${outstanding} due`)
  return { headline: headlineFor(order.paymentStatus), details }
}
