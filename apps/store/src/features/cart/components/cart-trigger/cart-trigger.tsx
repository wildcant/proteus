import { useLingui } from '@lingui/react/macro'
import { ShoppingBagIcon } from '@proteus/icons'
import { cn } from '@proteus/ui-core'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '#/components/ui/button/button'
import { useCart } from '#/entities/cart/api/cart'
import { CartBadge } from '#/features/cart/components/cart-badge/cart-badge'
import {
  cartTrigger,
  cartTriggerBadge,
  cartTriggerBag,
  cartTriggerGlyph,
} from '#/features/cart/components/cart-trigger/cart-trigger.variants'
import type { BagLinks } from '#/features/cart/types/links'

/**
 * The bag. One button at every width — the bar used to render an `sm:hidden` link to `/cart`
 * beside a `hidden sm:block` popover, so the bag behaved differently depending on the viewport
 * and two elements answered to `aria-label="Cart"`.
 *
 * It opens the panel rather than navigating: `/cart` is still reachable from the side menu and
 * the footer, but the bag itself is now a place to act, not a page to visit.
 */
export function CartTrigger({ links }: { links: Pick<BagLinks, 'open' | 'openEmpty'> }) {
  const { t } = useLingui()
  const { cart } = useCart()
  const navigate = useNavigate()

  const itemCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t`Cart`}
      onClick={() => navigate(itemCount > 0 ? links.open : links.openEmpty)}
    >
      {/* The badge hangs off the *glyph's* corner, so it anchors to this wrapper rather than to
          the button. `size="icon"` is 32px around a 20px bag, and offsets measured from the
          button's own corner land six pixels inside the bag, burying it under the counter.
          `h-5 w-5` over the drawn 16px glyph: the bag renders at 20px in the running store. */}
      <span className={cartTrigger()}>
        <ShoppingBagIcon className={cn(cartTriggerGlyph(), cartTriggerBag())} />
        {itemCount > 0 && <CartBadge count={itemCount} className={cartTriggerBadge()} />}
      </span>
    </Button>
  )
}
