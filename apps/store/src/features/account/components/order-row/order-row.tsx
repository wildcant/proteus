import { useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import { Link } from '@tanstack/react-router'
import type { StoreOrderListResponseOrdersItem } from '#/api/generated/model'
import { Icon } from '#/components/ui/icon/icon'
import { fulfillmentLabels } from '#/entities/order/lib/fulfillment-labels'
import {
  orderRow,
  orderRowChevron,
  orderRowDate,
  orderRowGlyph,
  orderRowInfo,
  orderRowNumber,
  orderRowPrimary,
  orderRowSecondary,
  orderRowStatus,
  orderRowThumbnail,
  orderRowThumbnails,
  orderRowTotal,
} from '#/features/account/components/order-row/order-row.variants'
import { useFormatters } from '#/hooks/use-formatters'

/** One past order in the account's list, the whole row the link to its page. */
export function OrderRow({ order, className }: { order: StoreOrderListResponseOrdersItem; className?: string }) {
  const { t } = useLingui()
  const { formatPrice, formatDate } = useFormatters()

  return (
    <Link to="/account/orders/$orderId" params={{ orderId: order.id }} className={cn(orderRow(), className)}>
      <OrderThumbnails items={order.items} />

      {/* Two lines on a phone — number and date, then status and total — rather than four
          columns squeezed into 360px. One line from lg. */}
      <div className={cn(orderRowInfo(), 'min-w-0')}>
        <div className={orderRowPrimary()}>
          <span className={orderRowNumber()}>#{order.displayId}</span>
          <span className={orderRowDate()}>{formatDate(order.createdAt)}</span>
        </div>
        <div className={orderRowSecondary()}>
          <span className={orderRowStatus()}>{t(fulfillmentLabels[order.fulfillmentStatus])}</span>
          <span className={orderRowTotal()}>{formatPrice(order.total, order.currencyCode)}</span>
        </div>
      </div>

      <Icon name="chevron-right" className={cn(orderRowChevron(), orderRowGlyph(), 'shrink-0')} />
    </Link>
  )
}

/** At most three, then a count. Beyond that the strip is wider than the row it labels. */
function OrderThumbnails({ items }: { items: StoreOrderListResponseOrdersItem['items'] }) {
  const shown = items.slice(0, 3)
  const remaining = items.length - shown.length

  return (
    <div className={cn(orderRowThumbnails(), 'shrink-0')}>
      {shown.map((item) => (
        <div key={item.id} className={orderRowThumbnail()}>
          {item.thumbnail ? (
            <img src={item.thumbnail} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-ink-subtle">
              <Icon name="package" className="size-4" />
            </div>
          )}
        </div>
      ))}
      {/* Not drawn: no seeded order has more than three lines. */}
      {remaining > 0 ? <span className="text-ink-muted text-xs">+{remaining}</span> : null}
    </div>
  )
}
