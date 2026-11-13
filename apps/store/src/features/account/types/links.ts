import type { LinkTarget } from '#/lib/link-target'

/** The account page's ways out, the `AccountDetail` screen's on the flow map. */
export type AccountLinks = {
  /** ADDRESS_BOOK. */
  addressBook: LinkTarget
  /** PAYMENT_METHODS. */
  paymentMethods: LinkTarget
  /** ORDER: one order's page. */
  order: (orderId: string) => LinkTarget
  /** SHOP_ALL, from an account with no orders. */
  shopAll: LinkTarget
  /** SIGN_OUT. */
  signedOut: LinkTarget
}

/** The wallet page's ways out, the `PaymentMethodsBook` screen's. */
export type PaymentMethodsLinks = {
  /** BACK_TO_ACCOUNT. */
  account: LinkTarget
  /** START_SHOPPING, from an empty wallet. */
  startShopping: LinkTarget
}
