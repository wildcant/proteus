/**
 * The one answer a wallet operation gives for a method it cannot act on.
 *
 * Named once because three places have to agree on it: the Stripe adapter, which turns the
 * gateway's two different refusals into this; the payment module, which raises it when no
 * provider claims the method; and the storefront, which branches on it to refetch the wallet and
 * reset the selection. A typo in any of them is a shopper stuck on a card that no longer exists.
 *
 * It rides on a `conflict`, which is a 409 — the status the storefront reads as "your wallet is
 * stale", as opposed to a 404 for a route that does not exist.
 */
export const PAYMENT_METHOD_UNAVAILABLE = 'payment_method_unavailable'
