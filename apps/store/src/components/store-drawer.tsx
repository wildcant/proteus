import { RouteDrawer } from '@proteus/ui'
import type { PropsWithChildren } from 'react'

type StoreDrawerProps = PropsWithChildren<{
  /**
   * Where closing the drawer goes. `RouteDrawer` defaults to `..`, which is only right when the
   * drawer sits one segment below its page — `/addresses/$addressId/edit` sits two, and `..`
   * lands on an `$addressId` route that does not exist.
   */
  prev?: string
}>

/**
 * The storefront's treatment of the shared `RouteDrawer`.
 *
 * The shadow is the reason this exists: `RouteDrawer` carries one for the admin, and this system
 * has no other shadows, so it is overridden here rather than taken away from a component the
 * admin also uses. Square corners need no override — `--radius: 0` resolves them on its own.
 *
 * The width goes through `style` rather than a class because `DrawerContent` sets
 * `--drawer-content-width` behind a `data-[swipe-axis=x]:` selector, which outranks a plain
 * utility. `min()` covers the phone without a media query: below 28rem it resolves to the full
 * viewport, which is exactly what the drawer wants there.
 */
export function StoreDrawer({ prev, children }: StoreDrawerProps) {
  return (
    <RouteDrawer
      prev={prev}
      className="shadow-none data-[swipe-direction=right]:border-l"
      style={{ '--drawer-inset': '0px', '--drawer-content-width': 'min(100dvw, 28rem)' } as React.CSSProperties}
    >
      {children}
    </RouteDrawer>
  )
}
