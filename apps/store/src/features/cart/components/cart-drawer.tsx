import { ShoppingBagIcon } from '@proteus/icons'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, formatPrice } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { InfoIcon, XIcon } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Button } from '#/components/button'
import { useCart } from '#/features/cart/api/cart'
import { CartDrawerSkeleton } from '#/features/cart/components/cart-drawer-skeleton'
import { CartEmpty } from '#/features/cart/components/cart-empty'
import { CartItem } from '#/features/cart/components/cart-item'
import { useModal } from '#/lib/modal-state'

/**
 * The cart, as a panel off the right edge. Open state is `?modal=cart`, so back closes it and two
 * overlays at once stays unrepresentable; it mounts in the `_main` layout route, so `/checkout`
 * cannot open it.
 */
export function CartDrawer() {
  const { isOpen, setOpen } = useModal('cart')
  const { cart, isLoading } = useCart()

  const items = cart?.items ?? []
  const sortedItems = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const currencyCode = cart?.currencyCode ?? 'usd'
  const hasItems = sortedItems.length > 0
  // A bag still loading keeps the notice and the body: showing them only once it resolved would
  // shove the rows down.
  const isEmpty = !isLoading && !hasItems

  return (
    <Drawer open={isOpen} onOpenChange={setOpen} swipeDirection="right">
      <DrawerContent
        className="bg-surface data-[swipe-direction=right]:rounded-none lg:w-125"
        // Inline because the primitive sets this behind a `data-[swipe-axis=x]:` selector, which
        // outranks a bare utility. `lg:w-125` wins as a media-query utility.
        style={{ '--drawer-content-width': '100%' } as CSSProperties}
      >
        {/* 88px, and no rule: the title is separated from the body by space rather than a line. */}
        <div className="flex h-22 shrink-0 items-center justify-between gap-4 px-4 lg:px-6">
          {/* The visible heading is also the dialog's accessible name. */}
          <DrawerTitle className="type-heading text-ink">Your Bag</DrawerTitle>

          <DrawerClose
            render={<Button variant="ghost" size="icon" aria-label="Close cart" className="-mr-2 size-11" />}
          >
            {/* 24px inside a 44px target; at 20 the mark read as adrift in an empty button. */}
            <XIcon className="size-6" />
          </DrawerClose>
        </div>

        {isEmpty ? (
          <CartEmpty />
        ) : (
          <>
            {/* One region for rows and summary together. With the list alone as `flex-1` the slack
                collected mid-panel; here it falls below the total, where it reads as room. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 lg:px-6">
              {/* Scrolls with the content: a disclosure, not a banner. Nothing here reserves cart
                  stock, so the same unit can be sold twice — which makes this the honest line. */}
              <p className="m-0 flex shrink-0 items-start gap-2 pb-6 text-ink text-sm">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong className="font-bold">Items in your cart aren't reserved.</strong> Check out soon to make sure
                  you don't miss out.
                </span>
              </p>

              {isLoading ? (
                <CartDrawerSkeleton />
              ) : (
                <>
                  {/* Space, not rules: a hairline per row turns a bag of three into a table. */}
                  <ul className="m-0 flex list-none flex-col gap-6 p-0">
                    {sortedItems.map((item) => (
                      <CartItem key={item.id} item={item} currencyCode={currencyCode} />
                    ))}
                  </ul>

                  {/* On white. With no cross-sell rail to band against, --surface-subtle here is
                      just the heaviest block on the panel sitting at the bottom of it. */}
                  <section className="mt-10 pb-6">
                    <h3 className="type-heading text-ink">Order summary</h3>

                    {/* No subtotal row: with no shipping figure it prints the total's number under
                        a second label, and shipping has no amount until the delivery step. */}
                    <dl className="m-0 mt-4 flex flex-col gap-3">
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="text-ink-muted text-sm">Shipping</dt>
                        <dd className="m-0 text-ink-muted text-sm">Calculated at checkout</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-4">
                        <dt className="font-bold text-ink text-sm">Total</dt>
                        <dd className="m-0 font-bold text-ink text-sm tabular-nums">
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
            <div className="shrink-0 bg-surface px-2 pt-4 pb-6 shadow-panel">
              {/* "Checkout", not "securely": that is a payment claim one test-only provider cannot make. */}
              <Button render={<Link to="/checkout" />} className="w-full gap-2">
                <ShoppingBagIcon className="h-4 w-4" />
                Checkout
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
