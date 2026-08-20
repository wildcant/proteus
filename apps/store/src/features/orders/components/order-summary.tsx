import { formatPrice, Separator } from '@proteus/ui'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { OrderItems } from './order-items'

export function OrderSummary({ order }: { order: StoreOrderResponseOrder }) {
  return (
    <section className="mt-8">
      <h3 className="font-bold text-foreground text-xl">Summary</h3>

      <div className="mt-4">
        <OrderItems order={order} />
      </div>

      <dl className="mt-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-(--foreground-muted)">Subtotal (excl. shipping and taxes)</dt>
          <dd className="font-medium text-foreground">{formatPrice(order.totals.itemsTotal, order.currencyCode)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-(--foreground-muted)">Shipping</dt>
          <dd className="font-medium text-foreground">{formatPrice(order.totals.shippingTotal, order.currencyCode)}</dd>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between text-base">
          <dt className="font-semibold text-foreground">Total</dt>
          <dd className="font-semibold text-foreground">{formatPrice(order.totals.orderTotal, order.currencyCode)}</dd>
        </div>
      </dl>
    </section>
  )
}
