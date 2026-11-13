import { cn } from '@proteus/ui-core'
import { cartBadge, cartBadgeCount } from '#/features/cart/components/cart-badge/cart-badge.variants'

/**
 * The one hue in the bar. An ink badge disappears into the cluster of ink-coloured icons
 * it sits in, which is the whole reason this reaches for the accent.
 *
 * `text-surface` rather than `text-white`: the token inverts per scheme, so the numerals
 * stay dark on the lifted blue in dark mode, where white would fall under 4.5:1.
 */
export function CartBadge({ count, className }: { count: number; className?: string }) {
  return <span className={cn(cartBadge(), cartBadgeCount(), className)}>{count > 99 ? '99+' : String(count)}</span>
}
