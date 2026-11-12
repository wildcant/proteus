import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreOrderResponseOrder } from '#/api/generated/model'
import { Icon } from '#/components/ui/icon/icon'
import {
  orderItems,
  orderItemsCount,
  orderItemsImage,
  orderItemsInfo,
  orderItemsItem,
  orderItemsMedia,
  orderItemsOptions,
  orderItemsPrice,
  orderItemsQuantity,
  orderItemsText,
  orderItemsThumbnail,
  orderItemsTitle,
} from '#/features/orders/components/order-items/order-items.variants'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * The checkout summary's row, on the record of the checkout that produced it — same 4:5 cover,
 * same badge quantity, same right-aligned line total, so the shopper recognises what they
 * already read twice before paying.
 *
 * Deliberately not the checkout summary's scroll region: that exists because the summary is
 * pinned in a sticky column. This page is a document, and a scroll box inside a scrolling page
 * is two gestures doing one job.
 *
 * A package, not the checkout summary's shopping bag: a bag is the thing you are still carrying.
 */
export function OrderItems({ order, className }: { order: StoreOrderResponseOrder; className?: string }) {
  const { formatPrice } = useFormatters()

  return (
    <ul className={cn(orderItems(), className)}>
      {order.lineItems.map((item) => (
        <li key={item.id} className={orderItemsItem()}>
          <div className={cn(orderItemsMedia(), 'shrink-0')}>
            <div className={cn(orderItemsThumbnail(), 'aspect-4/5')}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className={cn(orderItemsImage(), 'h-full w-full object-cover')} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-subtle">
                  <Icon name="package" className="h-4 w-4" />
                </div>
              )}
            </div>
            <span className={orderItemsQuantity()}>
              <span className={cn(orderItemsCount(), 'tabular-nums')}>{item.quantity}</span>
            </span>
          </div>

          {/* Stacked below `sm`, side by side above it. Sharing one row with the line total left
              the title about ninety pixels on a 320px phone, which broke product names mid-word
              and wrapped prices between their own digits — a price split across two lines is
              unreadable for the moment it takes to find the rest of it. */}
          <div className={cn(orderItemsInfo(), 'min-w-0')}>
            <div className={cn(orderItemsText(), 'min-w-0')}>
              {/* No line-clamp: truncating what someone bought on the record of them buying it
                  is not a trade worth making. */}
              <p className={cn(orderItemsTitle(), 'wrap-break-word')}>{item.title}</p>
              {/* `variantOptionValues` is the same string the cart drawer and the checkout summary
                  showed. `variantTitle` is what orders placed before that column have. */}
              {!!(item.variantOptionValues ?? item.variantTitle) && (
                <p className={orderItemsOptions()}>{item.variantOptionValues ?? item.variantTitle}</p>
              )}
              {/* The arithmetic behind the only number on the row (not drawn: the seed orders one
                  of each). The checkout summary can leave it out because the shopper is still
                  holding the cart that set it; a receipt read six months later cannot. */}
              {item.quantity > 1 && (
                <p className={cn(orderItemsOptions(), 'whitespace-nowrap tabular-nums')}>
                  <Trans>{formatPrice(item.unitPrice, order.currencyCode)} each</Trans>
                </p>
              )}
            </div>
            {/* Right-aligned at both widths. Stacked under the details it would otherwise read as
                a fourth meta line rather than the row's total. */}
            <span className={cn(orderItemsPrice(), 'shrink-0 whitespace-nowrap tabular-nums')}>
              {formatPrice(item.lineTotal, order.currencyCode)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
