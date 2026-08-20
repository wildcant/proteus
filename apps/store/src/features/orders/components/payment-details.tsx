import { formatPrice } from '@proteus/ui'
import { formatDatetime } from '@proteus/utils'
import type { StoreOrderResponseOrder } from '#/api/generated/model'

export function PaymentDetails({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <section>
      <h3 className="font-bold text-foreground text-xl">Payment</h3>

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="font-semibold text-foreground text-sm">Payment method</p>
          <p className="mt-1 text-(--foreground-muted) text-sm">
            {order.paymentStatus === 'captured' ? 'Payment received' : 'Awaiting payment'}
          </p>
        </div>

        <div>
          <p className="font-semibold text-foreground text-sm">Payment details</p>
          <p className="mt-1 text-(--foreground-muted) text-sm">
            {formatPrice(order.totals.orderTotal, order.currencyCode)} paid at {formatDatetime(order.createdAt)}
          </p>
        </div>
      </div>
    </section>
  )
}
