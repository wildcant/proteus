import { Trans } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { StoreCartDetailResponseCart } from '#/api/generated/model'
import { Icon } from '#/components/ui/icon/icon'
import {
  checkoutSummaryBody,
  checkoutSummaryBodyCount,
  checkoutSummaryBodyImage,
  checkoutSummaryBodyInfo,
  checkoutSummaryBodyItem,
  checkoutSummaryBodyItems,
  checkoutSummaryBodyItemTitle,
  checkoutSummaryBodyMedia,
  checkoutSummaryBodyOptions,
  checkoutSummaryBodyPrice,
  checkoutSummaryBodyQuantity,
  checkoutSummaryBodyShipping,
  checkoutSummaryBodyShippingLabel,
  checkoutSummaryBodyShippingValue,
  checkoutSummaryBodySubtotal,
  checkoutSummaryBodySubtotalLabel,
  checkoutSummaryBodySubtotalValue,
  checkoutSummaryBodyText,
  checkoutSummaryBodyThumbnail,
  checkoutSummaryBodyTotal,
  checkoutSummaryBodyTotalLabel,
  checkoutSummaryBodyTotals,
  checkoutSummaryBodyTotalValue,
} from '#/features/checkout/components/checkout-summary-body/checkout-summary-body.variants'
import { useFormatters } from '#/hooks/use-formatters'

/**
 * The order, as items and totals. Knows nothing about where it is rendered — the desktop panel and
 * the phone disclosure are two trees around this one body, which is what stops them drifting. One
 * scroll region holds the rows *and* the totals, the shape `cart-drawer.tsx` settled on.
 */
export function CheckoutSummaryBody({ cart, className }: { cart: StoreCartDetailResponseCart; className?: string }) {
  const { formatPrice } = useFormatters()

  return (
    <div className={cn(checkoutSummaryBody(), className)}>
      {/* `-mt-2 pt-2`: room inside the scroller for the quantity badge that sits 8px above it. */}
      <ul className={cn(checkoutSummaryBodyItems(), 'm-0 -mt-2 min-h-0 flex-1 list-none p-0 pt-2')}>
        {cart.items.map((item) => (
          <li key={item.id} className={checkoutSummaryBodyItem()}>
            <div className={cn(checkoutSummaryBodyMedia(), 'shrink-0')}>
              <div className={cn(checkoutSummaryBodyThumbnail(), 'aspect-4/5')}>
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className={cn(checkoutSummaryBodyImage(), 'h-full w-full object-cover')}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink-subtle">
                    <Icon name="bag" className="h-4 w-4" />
                  </div>
                )}
              </div>
              <span className={checkoutSummaryBodyQuantity()}>
                <span className={cn(checkoutSummaryBodyCount(), 'tabular-nums')}>{item.quantity}</span>
              </span>
            </div>

            <div className={cn(checkoutSummaryBodyInfo(), 'min-w-0')}>
              <div className={cn(checkoutSummaryBodyText(), 'min-w-0')}>
                <p className={cn(checkoutSummaryBodyItemTitle(), 'm-0')}>{item.title}</p>
                {!!item.variantOptionValues && (
                  <p className={cn(checkoutSummaryBodyOptions(), 'm-0')}>{item.variantOptionValues}</p>
                )}
              </div>
              <span className={cn(checkoutSummaryBodyPrice(), 'shrink-0 tabular-nums')}>
                {formatPrice(item.lineTotal, cart.currencyCode)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <dl className={cn(checkoutSummaryBodyTotals(), 'm-0 shrink-0')}>
        <div className={checkoutSummaryBodySubtotal()}>
          <dt className={checkoutSummaryBodySubtotalLabel()}>
            <Trans>Subtotal</Trans>
          </dt>
          <dd className={cn(checkoutSummaryBodySubtotalValue(), 'm-0 tabular-nums')}>
            {formatPrice(cart.totals.itemsTotal, cart.currencyCode)}
          </dd>
        </div>
        <div className={checkoutSummaryBodyShipping()}>
          <dt className={checkoutSummaryBodyShippingLabel()}>
            <Trans>Shipping</Trans>
          </dt>
          <dd className={cn(checkoutSummaryBodyShippingValue(), 'm-0 tabular-nums')}>
            {cart.shippingMethods.length > 0 ? (
              formatPrice(cart.totals.shippingTotal, cart.currencyCode)
            ) : (
              <Trans>Enter shipping address</Trans>
            )}
          </dd>
        </div>
        <div className={checkoutSummaryBodyTotal()}>
          <dt className={checkoutSummaryBodyTotalLabel()}>
            <Trans>Total</Trans>
          </dt>
          <dd className={cn(checkoutSummaryBodyTotalValue(), 'm-0 tabular-nums')}>
            {formatPrice(cart.totals.cartTotal, cart.currencyCode)}
          </dd>
        </div>
      </dl>
    </div>
  )
}
