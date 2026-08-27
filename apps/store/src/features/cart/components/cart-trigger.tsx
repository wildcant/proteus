import { ShoppingBagIcon } from '@proteus/icons'
import { Button } from '#/components/button'
import { useCart } from '#/features/cart/api/cart'
import { useModal } from '#/lib/modal-state'

/**
 * The bag. One button at every width — the bar used to render an `sm:hidden` link to `/cart`
 * beside a `hidden sm:block` popover, so the bag behaved differently depending on the viewport
 * and two elements answered to `aria-label="Cart"`.
 *
 * It opens the panel rather than navigating: `/cart` is still reachable from the side menu and
 * the footer, but the bag itself is now a place to act, not a page to visit.
 */
export function CartTrigger() {
  const { cart } = useCart()
  const { setOpen } = useModal('cart')

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <Button variant="ghost" size="icon" aria-label="Cart" onClick={() => setOpen(true)}>
      {/* The badge hangs off the *glyph's* corner, so it anchors to this wrapper rather than to
          the button. `size="icon"` is 32px around a 20px bag, and offsets measured from the
          button's own corner land six pixels inside the bag, burying it under the counter. */}
      <span className="relative flex">
        <ShoppingBagIcon className="h-5 w-5" />
        {itemCount > 0 && <CartBadge count={itemCount} />}
      </span>
    </Button>
  )
}

/**
 * The one hue in the bar. An ink badge disappears into the cluster of ink-coloured icons
 * it sits in, which is the whole reason this reaches for the accent.
 *
 * `text-surface` rather than `text-white`: the token inverts per scheme, so the numerals
 * stay dark on the lifted blue in dark mode, where white would fall under 4.5:1.
 */
function CartBadge({ count }: { count: number }) {
  return (
    <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-bold text-[10px] text-surface leading-none">
      {count > 99 ? '99+' : String(count)}
    </span>
  )
}
