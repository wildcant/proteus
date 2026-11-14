import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { CSSProperties } from 'react'
import { Button, ButtonLink } from '#/components/ui/button/button'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from '#/components/ui/drawer/drawer'
import { Icon } from '#/components/ui/icon/icon'
import { useCart } from '#/entities/cart/api/cart'
import {
  cartDrawer,
  cartDrawerBody,
  cartDrawerCheckout,
  cartDrawerClose,
  cartDrawerFooter,
  cartDrawerHeader,
  cartDrawerInfo,
  cartDrawerItem,
  cartDrawerItems,
  cartDrawerNotice,
  cartDrawerNoticeGlyph,
  cartDrawerNoticeIcon,
  cartDrawerRows,
  cartDrawerShippingLabel,
  cartDrawerShippingRow,
  cartDrawerShippingValue,
  cartDrawerSummary,
  cartDrawerSummaryTitle,
  cartDrawerTitle,
  cartDrawerTotalLabel,
  cartDrawerTotalRow,
  cartDrawerTotalValue,
} from '#/features/cart/components/cart-drawer/cart-drawer.variants'
import { CartDrawerSkeleton } from '#/features/cart/components/cart-drawer-skeleton/cart-drawer-skeleton'
import { CartEmpty } from '#/features/cart/components/cart-empty/cart-empty'
import { CartItem } from '#/features/cart/components/cart-item/cart-item'
import type { BagLinks } from '#/features/cart/types/links'
import { useFormatters } from '#/hooks/use-formatters'
import { useMarket } from '#/hooks/use-market'
import { useModal } from '#/lib/modal-state'

/**
 * The cart, as a panel off the right edge. Open state is `?modal=cart`, so back closes it and two
 * overlays at once stays unrepresentable; it mounts in the `_main` layout route, so `/checkout`
 * cannot open it.
 */
export function CartDrawer({ links }: { links: BagLinks }) {
  const { t } = useLingui()
  const { isOpen, setOpen } = useModal('cart', links)
  const { cart, isLoading } = useCart()
  const { formatPrice } = useFormatters()

  const items = cart?.items ?? []
  const sortedItems = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const { current: market } = useMarket()
  const currencyCode = cart?.currencyCode ?? market.currencyCode
  const hasItems = sortedItems.length > 0
  // A bag still loading keeps the notice and the body: showing them only once it resolved would
  // shove the rows down.
  const isEmpty = !isLoading && !hasItems

  return (
    <Drawer open={isOpen} onOpenChange={setOpen} swipeDirection="right">
      <DrawerContent
        className={cn(cartDrawer(), 'data-[swipe-direction=right]:rounded-none')}
        // Inline because the primitive sets this behind a `data-[swipe-axis=x]:` selector, which
        // outranks a bare utility. `lg:w-125` wins as a media-query utility.
        style={{ '--drawer-content-width': '100%' } as CSSProperties}
      >
        {/* 88px, and no rule: the title is separated from the body by space rather than a line. */}
        <div className={cn(cartDrawerHeader(), 'shrink-0')}>
          {/* The visible heading is also the dialog's accessible name. */}
          <DrawerTitle className={cartDrawerTitle()}>
            <Trans>Your Bag</Trans>
          </DrawerTitle>

          <DrawerClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={t`Close cart`}
                className={cn(cartDrawerClose(), '-mr-2')}
              />
            }
          >
            {/* 24px inside a 44px target; at 20 the mark read as adrift in an empty button. */}
            <Icon name="x" className="size-6" />
          </DrawerClose>
        </div>

        {isEmpty ? (
          <CartEmpty browseLink={links.browse} />
        ) : (
          <>
            {/* One region for rows and summary together. With the list alone as `flex-1` the slack
                collected mid-panel; here it falls below the total, where it reads as room. */}
            <div className={cn(cartDrawerBody(), 'min-h-0')}>
              {/* Scrolls with the content: a disclosure, not a banner. Nothing here reserves cart
                  stock, so the same unit can be sold twice — which makes this the honest line. */}
              <p className={cn(cartDrawerNotice(), 'm-0 shrink-0')}>
                <span className={cn(cartDrawerNoticeIcon(), 'shrink-0')}>
                  <Icon name="info" className={cn(cartDrawerNoticeGlyph(), cartDrawerInfo())} aria-hidden="true" />
                </span>
                <span>
                  <Trans>
                    <strong className="font-bold">Items in your cart aren't reserved.</strong> Check out soon to make
                    sure you don't miss out.
                  </Trans>
                </span>
              </p>

              {isLoading ? (
                <CartDrawerSkeleton />
              ) : (
                <>
                  {/* Space, not rules: a hairline per row turns a bag of three into a table. */}
                  <ul className={cn(cartDrawerItems(), 'm-0 list-none p-0')}>
                    {sortedItems.map((item) => (
                      <CartItem
                        key={item.id}
                        item={item}
                        currencyCode={currencyCode}
                        productLink={links.product}
                        className={cartDrawerItem()}
                      />
                    ))}
                  </ul>

                  {/* On white. With no cross-sell rail to band against, --surface-subtle here is
                      just the heaviest block on the panel sitting at the bottom of it. */}
                  <section className={cartDrawerSummary()}>
                    <h3 className={cn(cartDrawerSummaryTitle(), 'm-0')}>
                      <Trans>Order summary</Trans>
                    </h3>

                    {/* No subtotal row: with no shipping figure it prints the total's number under
                        a second label, and shipping has no amount until the delivery step. */}
                    <dl className={cn(cartDrawerRows(), 'm-0')}>
                      <div className={cartDrawerShippingRow()}>
                        <dt className={cartDrawerShippingLabel()}>
                          <Trans>Shipping</Trans>
                        </dt>
                        <dd className={cn(cartDrawerShippingValue(), 'm-0')}>
                          <Trans>Calculated at checkout</Trans>
                        </dd>
                      </div>
                      <div className={cartDrawerTotalRow()}>
                        <dt className={cartDrawerTotalLabel()}>
                          <Trans>Total</Trans>
                        </dt>
                        <dd className={cn(cartDrawerTotalValue(), 'm-0 tabular-nums')}>
                          {formatPrice(cart?.totals.cartTotal ?? '0', currencyCode)}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </>
              )}
            </div>

            {/* `px-2` against the panel's gutter is deliberate — the button runs 8px from each edge,
                near-bleed, which is what makes it read as the floor rather than another block. */}
            <div className={cn(cartDrawerFooter(), 'shrink-0')}>
              {/* "Checkout", not "securely": that is a payment claim one test-only provider cannot make.
                  The bag glyph's gap is the caller's: Button has no icon slot at size default. */}
              <ButtonLink {...links.checkout} className={cn(cartDrawerCheckout(), 'w-full gap-2')}>
                <Icon name="bag" className="h-4 w-4" />
                <Trans>Checkout</Trans>
              </ButtonLink>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
