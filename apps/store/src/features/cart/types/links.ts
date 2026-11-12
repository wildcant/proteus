import type { LinkTarget } from '#/lib/link-target'

/** The bag panel's ways in and out, the `Root` screen's bag states on the flow map. */
export type BagLinks = {
  /** OPEN_BAG with items in it. */
  open: LinkTarget
  /** OPEN_BAG with none. */
  openEmpty: LinkTarget
  close: LinkTarget
  /** CHECKOUT. */
  checkout: LinkTarget
  /** PRODUCT: a line's product page. */
  product: (productId: string) => LinkTarget
  /** BROWSE, from the empty bag. */
  browse: LinkTarget
}
