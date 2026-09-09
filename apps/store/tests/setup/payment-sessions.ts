import type { Page } from '@playwright/test'

/**
 * Counts the payment sessions a page opens. It observes; it fakes nothing.
 *
 * This exists for one claim, and only because that claim has no visual surface: **no PaymentIntent
 * is created until the shopper presses Place order.** The old implementation opened one on the
 * provider radio press, at whatever the cart totalled then, and a shopper who changed their mind
 * left an intent behind at every step. Nothing on screen distinguishes that from the correct
 * behaviour — the difference is entirely in when a request is made — so the request is what has to
 * be watched.
 *
 * Everything else these specs used to read off the wire has a surface and is asserted there: what
 * the shopper was charged is on the confirmation page, and what the *server* did with the session
 * (the smallest-unit conversion, `capture_method: manual`, cancelling a superseded intent) is in
 * `apps/backend/src/api/store/payment-collections/__tests__`, where the gateway is observable.
 *
 * Page-scoped, so a concurrent spec's presses are invisible to it.
 */
export function watchPaymentSessions(page: Page): { count(): number } {
  let opened = 0

  page.on('request', (request) => {
    if (request.method() !== 'POST') return
    if (!request.url().includes('/payment-sessions')) return
    opened += 1
  })

  return { count: () => opened }
}
