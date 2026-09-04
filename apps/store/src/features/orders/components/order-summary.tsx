import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'
import { useFormatters } from '#/lib/use-formatters'
import { OrderItems } from './order-items'

export function OrderSummary({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  const { formatPrice } = useFormatters()

  return (
    <Panel title="Summary" className={className}>
      <div className="mt-6">
        <OrderItems order={order} />
      </div>

      {/* The checkout summary's totals block, unchanged. "(excl. shipping and taxes)" goes: the
          shipping line is directly beneath it. */}
      <dl className="m-0 mt-6 flex flex-col gap-3 border-line border-t pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">Subtotal</dt>
          <dd className="m-0 whitespace-nowrap font-medium text-ink text-sm tabular-nums">
            {formatPrice(order.totals.itemsTotal, order.currencyCode)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">Shipping</dt>
          <dd className="m-0 whitespace-nowrap font-medium text-ink text-sm tabular-nums">
            {formatPrice(order.totals.shippingTotal, order.currencyCode)}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <dt className="font-bold text-base text-ink">Total</dt>
          <dd className="m-0 whitespace-nowrap font-bold text-base text-ink tabular-nums">
            {formatPrice(order.totals.orderTotal, order.currencyCode)}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}
