import type { LinkTarget } from '#/lib/link-target'

/** The checkout page's ways out, the `CheckoutContent` screen's on the flow map. */
export type CheckoutLinks = {
  /** BAG_EMPTY: nothing to check out. */
  bagEmpty: LinkTarget
  /** SIGN_IN, for a guest, coming back here once signed in. */
  signIn: LinkTarget
  /** SIGN_OUT: this page again, as a guest. */
  signedOut: LinkTarget
  /** PLACE_ORDER: the order's confirmation. */
  orderPlaced: (orderId: string) => LinkTarget
  /** ADD_ADDRESS. */
  addAddress: LinkTarget
  /** EDIT_ADDRESS. */
  editAddress: (addressId: string) => LinkTarget
}

/** The bank-redirect return page's ways out, the `CheckoutReturn` screen's. */
export type CheckoutReturnLinks = {
  /** ORDER_PLACED: the order's confirmation. */
  orderPlaced: (orderId: string) => LinkTarget
  /** BACK_TO_CHECKOUT. */
  checkout: LinkTarget
}
