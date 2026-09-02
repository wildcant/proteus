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
    // TODO(async-methods): the spec maps `processing` to `pending_authorization` for the method
    // types a provider option lists as asynchronous. Neither that option nor the payment-method
    // expansion it needs exists yet, so no method is asynchronous and `processing` is `pending`.
    case 'processing':
      return 'pending'
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
