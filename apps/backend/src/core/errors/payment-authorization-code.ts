/**
 * The one answer cart completion gives for a payment the provider has confirmed and not decided.
 *
 * Named once because it is the only thing that separates this failure from a declined card: both
 * refuse the cart, and without a `code` the response body for the two is byte-identical. Anything
 * acting on the difference — an operator reading a log, an alert that should page for a decline
 * and not for an intent still settling, the e2e that pins this contract — reads this constant.
 *
 * It rides on a `conflict`, which is a 409: the request is well formed and the payment is real,
 * the cart just cannot be completed in the state it is in *yet*. The `unexpected_state` a decline
 * raises is a 500, which says the server is broken; an intent doing exactly what the gateway
 * documents is not that.
 */
export const PAYMENT_AWAITING_AUTHORIZATION = 'payment_awaiting_authorization'
