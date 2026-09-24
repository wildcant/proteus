import { Trans, useLingui } from '@lingui/react/macro'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/panel'
import { useFormatters } from '#/hooks/use-formatters'
import { OrderItems } from './order-items'

export function OrderSummary({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  const { t } = useLingui()
  const { formatPrice } = useFormatters()

  return (
    <Panel title={t`Summary`} className={className}>
      <div className="mt-6">
        <OrderItems order={order} />
      </div>

      {/* The checkout summary's totals block, unchanged. "(excl. shipping and taxes)" goes: the
          shipping line is directly beneath it. */}
      <dl className="m-0 mt-6 flex flex-col gap-3 border-line border-t pt-6">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">
            <Trans>Subtotal</Trans>
          </dt>
          <dd className="m-0 whitespace-nowrap font-medium text-ink text-sm tabular-nums">
            {formatPrice(order.totals.itemsTotal, order.currencyCode)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted text-sm">
            <Trans>Shipping</Trans>
          </dt>
          <dd className="m-0 whitespace-nowrap font-medium text-ink text-sm tabular-nums">
            {formatPrice(order.totals.shippingTotal, order.currencyCode)}
          </dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between gap-4">
          <dt className="font-bold text-base text-ink">
            <Trans>Total</Trans>
          </dt>
          <dd className="m-0 whitespace-nowrap font-bold text-base text-ink tabular-nums">
            {formatPrice(order.totals.orderTotal, order.currencyCode)}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}
