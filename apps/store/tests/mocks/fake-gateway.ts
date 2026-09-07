import type { Page } from '@playwright/test'
import { FAKE_STRIPE_JS } from './fake-stripe-js.js'

/**
 * Serves the fake Stripe.js in place of the real script.
 *
 * `loadStripe` injects `<script src="https://js.stripe.com/…">` and then reads `window.Stripe`, so
 * replacing the response is the whole of it — the adapter under test is not modified, mocked or
 * branched on in any way.
 *
 * This is the only thing left of what was once a gateway client. The backend's Stripe handlers are
 * stateless now (`apps/backend/tests/mocks/msw/handlers/stripe.mocks.ts`), so there is no shared
 * gateway state for a spec to read or seed. What a spec needs instead is in `store-api.ts`.
 */
export async function useFakeStripe(page: Page): Promise<void> {
  await page.route('https://js.stripe.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_STRIPE_JS }),
  )
}
