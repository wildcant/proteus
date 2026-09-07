import type { PaymentSessionStatus } from '@core/types/payment/common.js'
import { test } from '@tests/setup/test-extend.js'
import type Stripe from 'stripe'
import { paymentActionOf, paymentSessionStatusOf } from '../status-map.js'

/** Only the three fields the mapping reads; the rest of a PaymentIntent is irrelevant here. */
function intent(status: Stripe.PaymentIntent.Status, lastPaymentError?: { code: string }): Stripe.PaymentIntent {
  // biome-ignore lint/style/useNamingConvention: the Stripe field the mapping reads
  return { status, last_payment_error: lastPaymentError } as unknown as Stripe.PaymentIntent
}

const TABLE: [Stripe.PaymentIntent.Status, PaymentSessionStatus][] = [
  ['requires_payment_method', 'pending'],
  ['requires_confirmation', 'pending'],
  ['processing', 'pending_authorization'],
  ['requires_action', 'requires_more'],
  ['requires_capture', 'authorized'],
  ['succeeded', 'captured'],
  ['canceled', 'canceled'],
]

test.describe('paymentSessionStatusOf', () => {
  for (const [intentStatus, sessionStatus] of TABLE) {
    test(`maps ${intentStatus} to ${sessionStatus}`, ({ expect }) => {
      expect(paymentSessionStatusOf(intent(intentStatus))).toBe(sessionStatus)
    })
  }

  test('distinguishes a declined intent from one still waiting for a card', ({ expect }) => {
    expect(paymentSessionStatusOf(intent('requires_payment_method', { code: 'card_declined' }))).toBe('error')
    expect(paymentSessionStatusOf(intent('requires_payment_method'))).toBe('pending')
  })

  /**
   * The row cart completion branches on, pinned as a contrast rather than on its own.
   *
   * `processing` used to map to `pending`, alongside an intent nobody had confirmed yet — so the
   * payment module could not tell money in flight from a card that had never been charged, and
   * cart completion unwound the order for both. The two states are separate names now, and this
   * is the assertion that keeps them separate.
   */
  test('separates an intent the gateway is still settling from one nothing has confirmed', ({ expect }) => {
    expect(paymentSessionStatusOf(intent('processing'))).toBe('pending_authorization')
    expect(paymentSessionStatusOf(intent('requires_confirmation'))).toBe('pending')
  })
})

test.describe('paymentActionOf', () => {
  test('answers with the same state whichever path asks', ({ expect }) => {
    // The bug this table replaced: about one `processing` intent, a session call said
    // `pending_authorization` and a webhook said `pending`. Both now read one table, so the
    // action a webhook produces is the status a session call reports — including for
    // `processing`, which is the pair that used to disagree.
    for (const [intentStatus] of TABLE) {
      const status = paymentSessionStatusOf(intent(intentStatus))
      expect(paymentActionOf(intent(intentStatus)), intentStatus).toBe(status)
    }
  })

  test('reports a declined intent as failed — the one name the two vocabularies spell apart', ({ expect }) => {
    const declined = intent('requires_payment_method', { code: 'card_declined' })

    expect(paymentSessionStatusOf(declined)).toBe('error')
    expect(paymentActionOf(declined)).toBe('failed')
  })
})
