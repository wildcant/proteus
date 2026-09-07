import type { Page } from '@playwright/test'
import { FAKE_STRIPE_JS } from './fake-stripe-js.js'

/**
 * Serves the fake Stripe.js in place of the real script.
 *
 * `loadStripe` injects `<script src="https://js.stripe.com/…">` and then reads `window.Stripe`, so
 * replacing the response is the whole of it — the adapter under test is not modified, mocked or
 * branched on in any way.
 *
 * Faking the *gateway's* script is the whole of what a spec here is allowed to fake. Our own API
 * is never stubbed: a wallet is arranged by shopping, and the backend's handlers
 * (`apps/backend/tests/mocks/msw/handlers/stripe.mocks.ts`) hold the cards the checkout saved.
 */
export async function useFakeStripe(page: Page): Promise<void> {
  await page.route('https://js.stripe.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE_JS }),
  )
}
