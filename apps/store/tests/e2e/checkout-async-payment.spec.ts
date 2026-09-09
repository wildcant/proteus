import type { Page } from '@playwright/test'
import { FAKE_GATEWAY, PaymentErrorCodes } from 'backend/test'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { useFakeStripe } from '../mocks/fake-gateway.js'
import { FAKE_CARDS } from '../mocks/fake-stripe-js.js'
import { watchPaymentSessions } from '../setup/payment-sessions.js'
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
 * **The assertion that moved red to green was the classification**, not the money. Before that fix
 * the completion request answered `type: "unexpected_state"` with `Payment authorization failed
 * for session "…"` — byte-identical to a decline. After it, the response carries its own authored
 * `code`.
 *
 * Both halves of "still settling" are arranged by the cart's own total: the browser confirms with
 * a card the fake Stripe.js leaves in `processing`, and the server reads back a `processing`
 * intent because `FAKE_GATEWAY.settlingTotalCents` is what the cart came to. The gateway keeps no
 * state either side of that, which is why the total has to carry the instruction.
 *
 * That statelessness is also why the second half of the story — the money arrives and the order
 * appears — is asserted one layer down rather than here. It needs the gateway to change its mind
 * mid-test, which is the one thing a fake driven entirely by the cart total cannot do. See the
 * closing block.
 */
test.describe('Checkout — a payment that is still settling', () => {
  test.describe.configure({ timeout: 120_000 })

  test('is refused with its own code, distinct from a decline, and becomes an order once it settles', async ({
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

    const sessions = watchPaymentSessions(page)

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

    // 1 · The premise: a session was opened. The cart totals the figure that makes the gateway
    // hold its intent in `processing`, asserted above, so the money is in flight — everything
    // below rests on that.
    expect(sessions.count(), 'no payment session was opened, so nothing was confirmed').toBe(1)

    // 2 · The red→green assertion. Before the fix this was a 500 carrying `unexpected_state` and
    // the decline's own message; a caller had nothing to branch on. `code` is an authored constant
    // imported from the backend, so a typo on either side fails rather than passes.
    expect(await response.json()).toMatchObject({ code: PaymentErrorCodes.AWAITING_AUTHORIZATION })
    expect(response.status()).toBe(409)

    // 3 · The shopper is not taken to a confirmation, and is left on a checkout they can press
    // again. The workflow creates an order and unwinds it, so "no order survived" is the sharper
    // fact — but that is a fact about the database, and `checkout-authorization.api.test.ts` owns
    // it. What is assertable here is what the shopper is left looking at.
    await expect(page.getByRole('heading', { name: /thank you/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /place order/i })).toBeEnabled()

    // And what they are *not* told. Nothing on the page says the payment is still going through —
    // no alert, and an empty notifications region — so a shopper whose money is in flight is left
    // with a checkout that looks like it simply did not respond. Asserted rather than left
    // unmentioned, because it is the current behaviour and the next person should find it stated
    // here rather than discover it. It is a gap in the copy, not in the classification below.
    await expect(page.getByRole('alert')).toHaveCount(0)

    // ---------------------------------------------------------------------------------------
    // 4 · The money arrives, and so does the order — asserted one layer down.
    //
    // The intent settles, Stripe sends `payment_intent.succeeded`, and the route publishes
    // `payment.captured`. The subscriber records the capture and re-runs cart completion for the
    // cart behind the session, so the shopper who was refused above ends with the order they paid
    // for rather than a charge with nothing behind it.
    //
    // It was asserted here while the fake gateway could be told to change its mind mid-test.
    // Driving it from the browser now would mean settling an intent the fake decides about from
    // the cart total alone, so it lives one layer down, where the gateway is directly observable:
    // `payment-webhook.api.test.ts` -> "POST /hooks/payment/:provider — a payment that settled
    // after checkout was refused" -> "ends with one order, one charge, and the same confirmation
    // everyone else gets". That suite drives a signed webhook through the real route, so every hop
    // between the capture and the order is covered; what is lost here is only the browser in front
    // of it, which asserts nothing about this half.
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
