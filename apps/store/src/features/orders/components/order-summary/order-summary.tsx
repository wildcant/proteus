import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Panel } from '#/components/store/panel/panel'
import { OrderItems } from '#/features/orders/components/order-items/order-items'
import {
  orderSummary,
  orderSummaryItems,
  orderSummaryList,
  orderSummaryPanel,
  orderSummaryShipping,
  orderSummaryShippingLabel,
  orderSummaryShippingValue,
  orderSummarySubtotal,
  orderSummarySubtotalLabel,
  orderSummarySubtotalValue,
  orderSummaryTotal,
  orderSummaryTotalLabel,
  orderSummaryTotals,
  orderSummaryTotalValue,
} from '#/features/orders/components/order-summary/order-summary.variants'
import { useFormatters } from '#/hooks/use-formatters'

/** The order's lines and totals. The set's root and its Panel instance are one element here. */
export function OrderSummary({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  const { t } = useLingui()
  const { formatPrice } = useFormatters()

  return (
    <Panel title={t`Summary`} className={cn(orderSummary(), orderSummaryPanel(), className)}>
      <div className={orderSummaryItems()}>
        <OrderItems order={order} className={orderSummaryList()} />
      </div>

      {/* The checkout summary's totals block, unchanged. "(excl. shipping and taxes)" goes: the
          shipping line is directly beneath it. */}
      <dl className={orderSummaryTotals()}>
        <div className={orderSummarySubtotal()}>
          <dt className={orderSummarySubtotalLabel()}>
            <Trans>Subtotal</Trans>
          </dt>
          <dd className={cn(orderSummarySubtotalValue(), 'whitespace-nowrap tabular-nums')}>
            {formatPrice(order.totals.itemsTotal, order.currencyCode)}
          </dd>
        </div>
        <div className={orderSummaryShipping()}>
          <dt className={orderSummaryShippingLabel()}>
            <Trans>Shipping</Trans>
          </dt>
          <dd className={cn(orderSummaryShippingValue(), 'whitespace-nowrap tabular-nums')}>
            {formatPrice(order.totals.shippingTotal, order.currencyCode)}
          </dd>
        </div>
        <div className={orderSummaryTotal()}>
          <dt className={orderSummaryTotalLabel()}>
            <Trans>Total</Trans>
          </dt>
          <dd className={cn(orderSummaryTotalValue(), 'whitespace-nowrap tabular-nums')}>
            {formatPrice(order.totals.orderTotal, order.currencyCode)}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}
