import type { MenuLinkTo } from '#/components/header/menu'
import type { LinkTarget } from '#/lib/link-target'

/** The `Root` screen's ways out, from the flow map, which the `_main` layout hands the bar. */
export type HeaderLinks = {
  home: LinkTarget
  account: LinkTarget
  menu: MenuLinkTo
  openMenu: LinkTarget
  openSearch: LinkTarget
  close: LinkTarget
}
