/**
 * The one answer opening a payment session gives while an earlier attempt is still settling.
 *
 * A session at `pending_authorization` is confirmed money the gateway has not finished deciding
 * on. It cannot be superseded — cancelling it would leave the ledger describing money that still
 * exists — and it must not simply be left standing either, because a second session alongside it
 * puts two live intents on one collection and cart completion authorizes whichever the database
 * happened to return first. So the second attempt is refused rather than opened.
 *
 * A `conflict`, which is a 409: the request is well formed and names a real collection, and the
 * shopper may well be able to open a session on it a moment later. Nothing is wrong with the
 * request and nothing is wrong with the server.
 *
 * Distinct from [PAYMENT_AWAITING_AUTHORIZATION] on purpose, though both describe the same
 * settling payment. That one refuses *completing the cart*; this one refuses *starting a second
 * attempt*. One code covering both would make an operator's alert ambiguous about which operation
 * was turned away.
 */
export const PAYMENT_ATTEMPT_IN_FLIGHT = 'payment_attempt_in_flight'
