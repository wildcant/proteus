import type { Page } from '@playwright/test'
import { db } from '@proteus/testing'
import { FAKE_GATEWAY, PaymentErrorCodes } from 'backend/test'
import { sql } from 'drizzle-orm'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { useFakeStripe } from '../mocks/fake-gateway.js'
import { FAKE_CARDS } from '../mocks/fake-stripe-js.js'
import { storeApi } from '../mocks/store-api.js'
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
 * `code`.
 *
 * Both halves of "still settling" are arranged by the cart's own total: the browser confirms with
 * a card the fake Stripe.js leaves in `processing`, and the server reads back a `processing`
 * intent because `FAKE_GATEWAY.settlingTotalCents` is what the cart came to. The gateway keeps no
 * state either side of that, which is why the total has to carry the instruction.
 */
test.describe('Checkout — a payment that is still settling', () => {
  test.describe.configure({ timeout: 120_000 })

  test('is refused with its own code, distinct from a decline, and leaves no order', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    // Priced so the cart totals exactly the figure the fake gateway reads as "keep settling this".
    // Both halves are pinned — the item and the shipping — because the total is the instruction:
    // the factory's own default would put it somewhere else and the intent would authorize
    // normally, passing this spec for the wrong reason. Asserted below rather than assumed.
    await using product = await factories.create.productWithPricing({ price: { amount: '37.77' } })
    await using shipping = await factories.create.shippingOptionWithZone({ shippingOption: { amount: 5 } })

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = storeApi.watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('settling-payment@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')
    await fillCard(page, FAKE_CARDS.settlesLater)

    expect(await readTotal(page), 'the cart no longer totals the settling amount').toBe(
      formatCents(FAKE_GATEWAY.settlingTotalCents),
    )
    const cartId = await readCartId(page)

    // Attached before the press, because the answer arrives with it. The completion request is the
    // only place the classification is observable — no copy on the page distinguishes these two
    // failures, and none is meant to.
    const completion = page.waitForResponse((response) => response.url().includes(`/carts/${cartId}/complete`))
    await page.getByRole('button', { name: /place order/i }).click()
    const response = await completion

    // 1 · The premise: a session was opened, at the total that makes the gateway hold the intent in
    // `processing`. The money is in flight, and everything below rests on that.
    const opened = await sessions.last()
    expect(opened, 'no payment session was opened, so nothing was confirmed').toBeDefined()
    expect(opened?.session.data.id).toBe(FAKE_GATEWAY.settlingIntentId)

    // 2 · The red→green assertion. Before the fix this was a 500 carrying `unexpected_state` and
    // the decline's own message; a caller had nothing to branch on. `code` is an authored constant
    // imported from the backend, so a typo on either side fails rather than passes.
    expect(await response.json()).toMatchObject({ code: PaymentErrorCodes.AWAITING_AUTHORIZATION })
    expect(response.status()).toBe(409)

    // 3 · No order. At the database rather than through the absent confirmation page: the workflow
    // creates an order and unwinds it, so "the shopper never saw a thank-you" and "no order
    // survived" are different facts and only the second one is the claim.
    expect(await liveOrderIdsForCart(cartId)).toEqual([])

    // ---------------------------------------------------------------------------------------
    // What this ticket does NOT fix, and where it is now written down.
    //
    // The intent settles, Stripe sends `payment_intent.succeeded`, and the webhook authorizes and
    // captures the session — money taken, against a cart that has no order. Nothing re-runs cart
    // completion, and the subscriber that would finish the order once the webhook resolves needs
    // the event-bus work; it is deliberately out of scope here and belongs to its own follow-up.
    //
    // It was asserted here while the fake gateway was stateful and the spec could settle the
    // intent behind the page's back. A stateless gateway cannot be told to change its mind, so
    // that assertion belongs one layer down, in `payment-webhook.api.test.ts`, where
    // `stripeTest.givenRetrievedStatus('succeeded')` says the same thing in one line.
    // ---------------------------------------------------------------------------------------
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

/** The total the shopper is looking at, read out of the summary rather than recomputed. */
async function readTotal(page: Page): Promise<string> {
  const total = page.getByRole('complementary').getByText('Total', { exact: true })
  await expect(total).toBeVisible()
  return (await total.locator('xpath=following-sibling::dd[1]').innerText()).trim()
}

/** `4277` as the summary renders it, so the assertion compares like with like. */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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
