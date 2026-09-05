import { createHmac } from 'node:crypto'
import type { Page } from '@playwright/test'
import { db, pollDatabase } from '@proteus/testing'
import { PAYMENT_AWAITING_AUTHORIZATION } from 'backend/test'
import { sql } from 'drizzle-orm'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import {
  gatewayIntentForSession,
  gatewayWatermark,
  intentsCreatedBy,
  trackPaymentSessions,
  useFakeStripe,
} from '../mocks/fake-gateway.js'
import { FAKE_CARDS, FAKE_GATEWAY_URL } from '../mocks/fake-stripe-js.js'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillShippingAddress } from '../setup/utils.js'

/**
 * A payment the gateway has confirmed and not finished settling.
 *
 * The defect this spec was written for: `authorizePaymentSession` answered `null` both for an
 * intent still settling and for a card the gateway refused, and cart completion turned both into
 * the same `unexpected_state`. So a shopper whose money was in flight got the checkout unwound as
 * though they had been declined, and nothing downstream could tell the two cases apart.
 *
 * **The assertion that moves red to green is the classification**, not the money. Before the fix
 * the completion request answered `type: "unexpected_state"` with `Payment authorization failed
 * for session "…"` — byte-identical to a decline. After it, the response carries its own authored
 * `code`. That is the whole of what changed, and the last block below records what did not.
 */
test.describe('Checkout — a payment that is still settling', () => {
  test.describe.configure({ timeout: 120_000 })

  test('is refused with its own code, distinct from a decline, and leaves no order', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = trackPaymentSessions(page)
    const watermark = await gatewayWatermark()

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('settling-payment@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')
    await fillCard(page, FAKE_CARDS.settlesLater)

    const cartId = await readCartId(page)

    // Attached before the press, because the answer arrives with it. The completion request is the
    // only place the classification is observable — no copy on the page distinguishes these two
    // failures, and none is meant to.
    const completion = page.waitForResponse((response) => response.url().includes(`/carts/${cartId}/complete`))
    await page.getByRole('button', { name: /place order/i }).click()
    const response = await completion

    // 1 · Confirmed, and the gateway is still settling it. Read at the gateway through the session
    // the page was handed, not inferred from the page: the money is in flight either way, and that
    // is the premise everything below rests on.
    const [created] = await intentsCreatedBy(sessions, watermark)
    const sessionId = String(created?.params['metadata[sessionId]'])
    expect(sessionId, 'no PaymentIntent was created, or it carried no session id').not.toBe('undefined')
    expect((await gatewayIntentForSession(sessionId)).status).toBe('processing')

    // 2 · The red→green assertion. Before the fix this was a 500 carrying `unexpected_state` and
    // the decline's own message; a caller had nothing to branch on. `code` is an authored constant
    // imported from the backend, so a typo on either side fails rather than passes.
    expect(await response.json()).toMatchObject({ code: PAYMENT_AWAITING_AUTHORIZATION })
    expect(response.status()).toBe(409)

    // 3 · No order. At the database rather than through the absent confirmation page: the workflow
    // creates an order and unwinds it, so "the shopper never saw a thank-you" and "no order
    // survived" are different facts and only the second one is the claim.
    expect(await liveOrderIdsForCart(cartId)).toEqual([])

    // ---------------------------------------------------------------------------------------
    // 4 · The residual, and what this ticket does NOT fix.
    //
    // The intent settles, Stripe sends `payment_intent.succeeded`, and the webhook authorizes and
    // captures the session — money taken, against a cart that has no order. Nothing re-runs cart
    // completion, and the subscriber that would finish the order once the webhook resolves needs
    // the event-bus work; it is deliberately out of scope here and belongs to its own follow-up.
    //
    // So this block is not an acceptance criterion. It is the end state ILLO-70 leaves in place,
    // written down so the follow-up has a failing shape to aim at rather than a description.
    // ---------------------------------------------------------------------------------------
    await settleIntentAtGateway(sessionId)
    await deliverWebhook(intentEventBody(await gatewayIntentForSession(sessionId), sessionId))

    const payment = await pollDatabase(
      () => capturedPaymentForSession(sessionId),
      `No captured payment landed for session "${sessionId}" after the webhook`,
    )
    expect(payment.capturedAt).not.toBeNull()

    // Charged, and still no order. This is the bug that outlives this ticket.
    expect(await liveOrderIdsForCart(cartId)).toEqual([])
  })
})

// ---------------------------------------------------------------------------------------------
// Steps shared by the spec above. Specific to this file, so they live in it.
// ---------------------------------------------------------------------------------------------

/** The routes this spec navigates to. Narrower than the fixture's, which is why it accepts it. */
type Navigate = (options: {
  to: Extract<FileRouteTypes['to'], '/products/$productId'>
  params?: Record<string, string>
}) => Promise<void>

async function addToCartAndCheckout(page: Page, navigate: Navigate, productId: string) {
  await navigate({ to: '/products/$productId', params: { productId } })

  // Generous, and not decoration: this is the only spec in its file, so it pays for the cold
  // route compile and the first cart write of the run with nothing ahead of it to have warmed
  // them. The default five seconds is a flake here and nowhere else.
  const addToCart = page.getByRole('button', { name: /add to cart/i })
  await expect(addToCart).toBeEnabled({ timeout: 30_000 })
  await addToCart.click()

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible({ timeout: 30_000 })
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/, { timeout: 30_000 })
}

/** By name, never `.first()`: concurrent specs each list their own US option. */
async function selectShipping(page: Page, name: string) {
  const option = page.getByRole('radio', { name })
  await expect(option).toBeVisible({ timeout: 15_000 })
  await option.click()
  await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 15_000 })
}

async function choosePayment(page: Page, label: string) {
  const provider = page.getByRole('radio', { name: label })
  await expect(provider).toBeVisible({ timeout: 15_000 })
  await provider.click()
  await expect(page.getByTestId('fake-stripe-frame')).toBeVisible({ timeout: 15_000 })
}

/** Types into the gateway's own frame, which is where a card is entered at the real gateway too. */
async function fillCard(page: Page, number: string) {
  await page.frameLocator('[data-testid="fake-stripe-frame"]').getByLabel('Card number').fill(number)
}

/** The cart the browser made. Its id only exists in the page's own storage. */
async function readCartId(page: Page): Promise<string> {
  const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
  expect(cartId, 'the page has no cart').toBeTruthy()
  return String(cartId)
}

/**
 * The orders still standing for a cart.
 *
 * Live rows on both sides: the compensation soft-deletes the order and dismisses the link, and a
 * query that ignored `deletedAt` would find the wreckage of the unwound checkout and call it an
 * order. The link is what `check-idempotency` reads, so it is what "an order exists" means here.
 */
async function liveOrderIdsForCart(cartId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    SELECT o.id
    FROM "order" o
    JOIN order_cart oc ON oc.order_id = o.id
    WHERE oc.cart_id = ${cartId} AND oc.deleted_at IS NULL AND o.deleted_at IS NULL
  `)
  return [...rows].map((row) => row.id)
}

/** The captured payment a session produced, or null while there is none to read. */
async function capturedPaymentForSession(sessionId: string): Promise<{ id: string; capturedAt: string } | null> {
  const rows = await db.execute<{ id: string; capturedAt: string }>(sql`
    SELECT id, captured_at AS "capturedAt"
    FROM payment
    WHERE payment_session_id = ${sessionId} AND captured_at IS NOT NULL AND deleted_at IS NULL
  `)
  return [...rows][0] ?? null
}

/**
 * Finishes the intent at the gateway, as Stripe would before it sends the event.
 *
 * The webhook is not the source of truth about the intent: `authorizePayment` re-reads it from the
 * gateway. Delivering `succeeded` against an intent the fake still holds as `processing` would
 * authorize nothing and prove nothing about the residual.
 */
async function settleIntentAtGateway(sessionId: string): Promise<void> {
  const intent = await gatewayIntentForSession(sessionId)
  const response = await fetch(`${FAKE_GATEWAY_URL}/intents/${intent.id}/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'succeeded' }),
  })
  expect(response.ok, `the fake gateway refused to settle "${intent.id}"`).toBe(true)
}

/** The event Stripe sends once the intent settles, carrying the intent the gateway now holds. */
function intentEventBody(intent: { id: string; amount: number }, sessionId: string): string {
  return JSON.stringify({
    id: `evt_fake_${intent.id}`,
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: intent.id,
        object: 'payment_intent',
        status: 'succeeded',
        amount: intent.amount,
        // biome-ignore lint/style/useNamingConvention: the Stripe wire field
        amount_received: intent.amount,
        currency: 'usd',
        metadata: { sessionId },
      },
    },
  })
}

/**
 * Delivers a genuinely signed webhook.
 *
 * Not a bypass: the route verifies a real HMAC-SHA256 over the exact bytes, and `constructEvent`
 * is local crypto rather than a call to Stripe — so signing with the same secret the server was
 * booted with produces an event it accepts for the same reason a real one is accepted. The route
 * acknowledges and defers the work, which is why the caller polls rather than reads the response.
 */
async function deliverWebhook(body: string): Promise<void> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  expect(secret, 'STRIPE_WEBHOOK_SECRET is unset — run the suite through `npm run test:e2e`').toBeTruthy()
  const backendUrl = process.env.VITE_BACKEND_URL
  expect(backendUrl, 'VITE_BACKEND_URL is unset — run the suite through `npm run test:e2e`').toBeTruthy()

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHmac('sha256', String(secret)).update(`${timestamp}.${body}`).digest('hex')

  // The registered provider id, not the adapter's name: the route resolves a provider row, and
  // `stripe` alone is not one. Same id the payment session was opened against.
  const response = await fetch(`${backendUrl}/hooks/payment/pp_stripe_default`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body,
  })
  expect(response.status, await response.text()).toBe(200)
}
