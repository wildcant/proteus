import type Stripe from 'stripe'
import type { PaymentActions, PaymentSessionStatus } from '../../core/types/payment/common.js'

/**
 * The one place a Stripe intent state becomes a Proteus payment state.
 *
 * Both routes out of this adapter read it: the status a session call returns, and the action a
 * webhook produces — a webhook event carries the intent it is about, so the same table answers
 * both. Written as two switch statements they drifted, and `processing` meant one thing to a
 * session call and another to a webhook for the same intent.
 */
export function paymentSessionStatusOf(intent: Stripe.PaymentIntent): PaymentSessionStatus {
  switch (intent.status) {
    case 'requires_payment_method':
      return intent.last_payment_error ? 'error' : 'pending'
    case 'requires_action':
      return 'requires_more'
    case 'requires_confirmation':
      return 'pending'
    /**
     * Confirmed, and the gateway has not finished deciding. `pending_authorization` is this
     * vocabulary's name for exactly that, and it is what separates a settling intent from a
     * refused one: `pending` also covers an intent nobody has confirmed yet, so mapping
     * `processing` there made cart completion read money in flight as a decline and unwind the
     * order while the charge kept settling.
     *
     * Unconditional, not gated on the method type. The spec's asynchronous-method option decides
     * what the checkout *does* next — place the order now and let the webhook reconcile it, or
     * wait — and that needs the subscriber that finishes an order once the webhook resolves. It
     * does not change whether the provider has decided, which is all this table answers.
     *
     * TODO(async-methods): the order-completing subscriber, and the provider option that lists
     * which method types are asynchronous. Until then a `processing` intent fails the checkout
     * loudly and correctly classified, rather than silently as a decline.
     */
    case 'processing':
      return 'pending_authorization'
    case 'requires_capture':
      return 'authorized'
    case 'succeeded':
      return 'captured'
    case 'canceled':
      return 'canceled'
    default:
      return 'pending'
  }
}

/**
 * Total over `PaymentSessionStatus`, so a status added to the union has to be given an action
 * here rather than silently becoming whatever a `default` branch guessed.
 */
const ACTION_BY_STATUS: Record<PaymentSessionStatus, PaymentActions> = {
  authorized: 'authorized',
  canceled: 'canceled',
  captured: 'captured',
  error: 'failed',
  pending: 'pending',
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentSessionStatus union member
  pending_authorization: 'pending_authorization',
  // biome-ignore lint/style/useNamingConvention: mirrors the PaymentSessionStatus union member
  requires_more: 'requires_more',
}

/** The webhook side of the same table. */
export function paymentActionOf(intent: Stripe.PaymentIntent): PaymentActions {
  return ACTION_BY_STATUS[paymentSessionStatusOf(intent)]
}
