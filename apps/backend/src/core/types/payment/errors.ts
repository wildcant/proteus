/**
 * The authored `code` values a payment failure answers with, where [ErrorTypes] alone is too coarse
 * for a client to act on. They live here, in the payment port, rather than beside `AppError`:
 * `AppError` is domain-agnostic and every domain that needs codes owns its own list.
 *
 * The wire values keep the `payment_` prefix the member names drop — they reach the response body
 * and the storefront branches on them, so they are a contract that must read unambiguously there.
 */
export enum PaymentErrorCodes {
  /** A second payment session refused while an earlier one is still settling, so a collection never
   *  carries two live intents. Rides on a `conflict`: the shopper may succeed a moment later. */
  ATTEMPT_IN_FLIGHT = 'payment_attempt_in_flight',
  /** Cart completion refused for a payment the provider has confirmed and not yet decided on. The
   *  only thing separating it from a declined card, whose response body is otherwise identical. */
  AWAITING_AUTHORIZATION = 'payment_awaiting_authorization',
  /** A wallet method no provider can act on. The storefront branches on it to refetch the wallet and
   *  reset the selection, which is why the Stripe adapter and the payment module both raise it. */
  METHOD_UNAVAILABLE = 'payment_method_unavailable',
  /** The gateway refused the card. One code for every decline reason, so the response body cannot
   *  be used to tell a lost card from a generic refusal — the store is not a card-testing oracle. */
  DECLINED = 'payment_declined',
  /** Cart completion reached a session nobody confirmed at the gateway. The shopper has not paid
   *  and no money moved; the checkout has to run the payment step before completing again. */
  NOT_CONFIRMED = 'payment_not_confirmed',
  /** The gateway wants the shopper first — a 3D Secure challenge outstanding. Not a refusal: the
   *  same session completes normally once the challenge returns. */
  REQUIRES_ACTION = 'payment_requires_action',
  /** The session was cancelled at the gateway and cannot be authorized. The checkout has to open a
   *  new one rather than retry this one. */
  SESSION_CANCELED = 'payment_session_canceled',
  /** The gateway is down, throttling us, or answered in a way that leaves the outcome unknown.
   *  The request was fine and retrying may work, which is what separates it from every code above. */
  GATEWAY_UNAVAILABLE = 'payment_gateway_unavailable',
  /** The gateway rejected *us* — a bad key, a malformed request, a version mismatch. The only
   *  payment code that is our bug rather than the shopper's state, and the only one on a 500. */
  GATEWAY_ERROR = 'payment_gateway_error',
}
