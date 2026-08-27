import { formatPrice } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'

/**
 * What was paid and when, and nothing that implies how. The order module stores no card brand
 * or last four — `transaction` records amounts, not instruments — so a "Payment method" heading
 * over a status was a lie of placement.
 */
export function PaymentDetails({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <Panel title="Payment">
      <p className="mt-6 text-ink text-sm">
        {order.paymentStatus === 'captured' ? 'Payment received' : 'Awaiting payment'}
      </p>
      <p className="mt-1 text-ink-muted text-sm">
        {formatPrice(order.totals.orderTotal, order.currencyCode)} on {formatDatetime(order.createdAt)}
      </p>
    </Panel>
  )
}
