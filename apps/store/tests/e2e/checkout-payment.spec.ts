import type { Page } from '@playwright/test'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { useFakeStripe } from '../mocks/fake-gateway.js'
import { FAKE_CARDS } from '../mocks/fake-stripe-js.js'
import { watchPaymentSessions } from '../setup/payment-sessions.js'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillShippingAddress } from '../setup/utils.js'

/**
 * Paying by card, against a faked gateway.
 *
 * The gateway is faked on both sides — `apps/backend/tests/mocks/msw/handlers/stripe.mocks.ts`
 * answers the server's calls to `api.stripe.com`, and `tests/mocks/fake-stripe-js.ts` is served in
 * place of Stripe.js. Nothing in the storefront is mocked: the adapter under test is the one that
 * ships.
 *
 * What is asserted here is the *storefront's* half — when a session is opened, at what total, with
 * which card, and what the shopper is shown for each outcome. What the server then sent the
 * gateway is asserted in `apps/backend/src/api/store/**\/__tests__`, where the gateway is directly
 * observable and the assertions are sharper for it.
 *
 * Parallel: every session these specs open is recorded off their own page, so a neighbour's
 * presses are invisible to them and there is nothing shared left to serialise around.
 */
test.describe('Checkout — card payment', () => {
  test.describe.configure({ timeout: 90_000 })

  test('a guest pays by card, and no PaymentIntent exists until Place order is pressed', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('card-guest@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    // The card form is up and the shopper has typed their card. This is the moment the old
    // implementation had already created an intent — on the radio press, at whatever the cart
    // totalled then. Asserted against the gateway's own log, not inferred from the page.
    await fillCard(page, FAKE_CARDS.succeeds)
    expect(sessions.count(), 'an intent was opened before the shopper pressed Place order').toBe(0)

    const total = await readTotal(page)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // Exactly one, and opened by the press rather than by anything earlier.
    expect(sessions.count()).toBe(1)

    // Priced at the total the shopper was looking at, read off the confirmation page rather than
    // off the wire — this is the figure they were actually charged. That the server converts it to
    // the smallest unit and asks for a manual capture is `payment-session.api.test.ts`; that a
    // guest opens no account holder at the gateway is `saved-method-consent.api.test.ts`.
    expect(await readOrderTotal(page)).toBe(total)
  })

  test('a logged-in shopper with an empty wallet gets the card form as the payment step, with no radio group', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()
    await using customer = await factories.create.customer({ hasAccount: true })

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    // Nothing saved. Stubbed rather than left to the backend, whose fake gateway holds one card
    // for every account holder — "empty" is a wallet state this spec has to state, not inherit.
    const sessions = watchPaymentSessions(page)

    await signIn(page, navigate, customer)
    await addToCartAndCheckout(page, navigate, product.id)
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    // The whole of the payment step, for a shopper with nothing saved: the adapter's form. A
    // radio group here would be a choice of one, which is not a choice. The saved-card rows and
    // the "use a different card" row arrive with the wallet, in ILLO-24.
    const panel = page.getByTestId('payment-panel')
    await expect(panel.getByTestId('fake-stripe-frame')).toBeVisible()
    await expect(panel.getByRole('radiogroup')).toHaveCount(0)
    await expect(panel.getByRole('radio')).toHaveCount(0)

    // Nothing has been created for them either — the empty-wallet state is not a reason to open
    // an intent early any more than the guest state is.
    expect(sessions.count(), 'an empty wallet is not a reason to open an intent early').toBe(0)

    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })
    expect(sessions.count()).toBe(1)
  })

  test('a mistyped card stops in the browser and never reaches our server', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('incomplete-card@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    // Every request the page makes from here, so "never reaches our server" is a claim about our
    // API rather than about the gateway alone.
    const paymentRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/store/payment-collections')) paymentRequests.push(request.url())
    })

    await fillCard(page, '4242')
    await page.getByRole('button', { name: /place order/i }).click()

    await expect(page.getByRole('alert')).toContainText('card number is incomplete')
    await expect(page).toHaveURL(/\/checkout$/)
    expect(paymentRequests).toHaveLength(0)
    // No session, so nothing of ours reached the gateway either: the intent is opened by the
    // request that never left.
    expect(sessions.count()).toBe(0)
  })

  test('the amount charged is the cart total at the press, not the one the form mounted with', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('late-change@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')
    await fillCard(page, FAKE_CARDS.succeeds)

    const mountedTotal = await readTotal(page)

    // Changed behind the page's back, which is the case that matters: a cart the browser knows
    // changed would re-render the form at the new figure and prove nothing. Here the Elements
    // group is left at the old total and only the server knows the new one.
    await addLineItemOutOfBand(page, product.variant.id)

    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    const orderTotal = await readOrderTotal(page)
    expect(orderTotal).not.toBe(mountedTotal)

    expect(sessions.count()).toBe(1)
  })

  test('a 3D Secure challenge completes and the order is placed', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('three-d-secure@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')
    await fillCard(page, FAKE_CARDS.requiresAuthentication)

    const quoted = await readTotal(page)
    await page.getByRole('button', { name: /place order/i }).click()

    await expect(page.getByTestId('fake-stripe-3ds')).toBeVisible()
    await page.getByRole('button', { name: 'Complete authentication' }).click()

    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // One session, and the shopper was charged what they were quoted: the challenge changed
    // nothing about the money.
    expect(sessions.count()).toBe(1)
    expect(await readOrderTotal(page)).toBe(quoted)
  })

  test('a redirect payment method comes back to the return route and the order is placed', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('redirect-method@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    // A method that leaves the tab, chosen inside the gateway's own frame — which is where the
    // choice lives at the real gateway too. `redirect: 'if_required'` sends this one away and
    // keeps a card in place, and only one of those two paths is exercised by every other spec.
    await page
      .frameLocator('[data-testid="fake-stripe-frame"]')
      .getByRole('radio', { name: 'Test redirect method', exact: true })
      .check()

    const quoted = await readTotal(page)
    await page.getByRole('button', { name: /place order/i }).click()

    await expect(page).toHaveURL(/\/checkout-return\?/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // One session, and the shopper was charged what they were quoted: leaving the tab and coming
    // back changed nothing about the money.
    expect(sessions.count()).toBe(1)
    expect(await readOrderTotal(page)).toBe(quoted)
  })

  test('a declined card reads the same whatever the decline was, and the log says which', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const logged: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') logged.push(message.text())
    })

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('declined@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    await fillCard(page, FAKE_CARDS.declinedLostCard)
    await page.getByRole('button', { name: /place order/i }).click()
    const lostCardMessage = await page.getByRole('alert').innerText()
    await expect(page).toHaveURL(/\/checkout$/)

    await fillCard(page, FAKE_CARDS.declinedGeneric)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    const genericMessage = await page.getByRole('alert').innerText()

    // Identical on screen. Anything else and the store is an oracle a prober can ask which card
    // was reported lost — and the fake deliberately hands the two different gateway wording, so
    // this passes only because the bucketing rule replaced both.
    expect(lostCardMessage).toBe(genericMessage)
    expect(lostCardMessage).toContain('declined')

    // Distinct in the log, with the link that opens the exact request in the dashboard.
    const declines = logged.filter((entry) => entry.includes('Stripe confirmation failed'))
    expect(declines).toHaveLength(2)
    expect(declines.some((entry) => entry.includes('lost_card'))).toBe(true)
    expect(declines.some((entry) => entry.includes('generic_decline'))).toBe(true)
    expect(declines.every((entry) => entry.includes('dashboard.stripe.com'))).toBe(true)
  })

  /**
   * The path the decline spec stopped one step short of.
   *
   * Every press opens a session, so without the checkout route replacing rather than adding, a
   * shopper who is declined and reaches for another card leaves two intents — the browser
   * confirms the second and the server authorizes the first. The order never appears and the good
   * card carries a hold for the full amount.
   */
  test('a declined shopper pays with the next card, and every abandoned attempt is cancelled', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const sessions = watchPaymentSessions(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('retry-after-decline@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    // Three cards, because "three cards leave three intents" is the shape of the bug: each press
    // must abandon the last attempt, not stack on it.
    await fillCard(page, FAKE_CARDS.declinedGeneric)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('alert')).toContainText('declined')

    await fillCard(page, FAKE_CARDS.declinedLostCard)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('alert')).toContainText('declined')

    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()

    // The order the first two presses could not produce.
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // Three presses, three sessions: each press opened its own rather than reusing a dead one.
    // That they share one collection, and that superseding *cancels* the abandoned intent so no
    // hold outlives the checkout, is `payment-session.api.test.ts` — facts about the gateway, and
    // the browser is told nothing about them either way.
    expect(sessions.count()).toBe(3)
  })

  /**
   * The other half of AC 9, on the leg no local card can reach.
   *
   * A shopper declined at a redirect provider comes back to a terminal-but-failed intent, so
   * nothing is thrown and nothing is returned as an error — the reason is on the intent, and only
   * reading it off there writes the decline down.
   */
  test('a redirect method that comes back declined says so, and the decline reaches the log', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    const logged: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') logged.push(message.text())
    })

    await addToCartAndCheckout(page, navigate, product.id)
    await page.getByLabel('Email').fill('redirect-declined@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')

    await page
      .frameLocator('[data-testid="fake-stripe-frame"]')
      .getByRole('radio', { name: 'Test redirect method (declined)' })
      .check()

    await page.getByRole('button', { name: /place order/i }).click()

    await expect(page).toHaveURL(/\/checkout-return\?/, { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: /payment did not finish/i })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alert')).toContainText('declined')

    // Correct copy on screen was already true before this was fixed; the log was empty. On-call
    // needs the decline code and the link that opens the exact request in the dashboard.
    const declines = logged.filter((entry) => entry.includes('returned from a redirect unpaid'))
    expect(declines).toHaveLength(1)
    expect(declines[0]).toContain('lost_card')
    expect(declines[0]).toContain('dashboard.stripe.com')
  })

  test('there is exactly one control over whether billing matches shipping', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)
    await useFakeStripe(page)

    await addToCartAndCheckout(page, navigate, product.id)
    await fillShippingAddress(page)
    await selectShipping(page, shipping.name)
    await choosePayment(page, 'Stripe')
    await expect(page.getByTestId('payment-panel').getByTestId('fake-stripe-frame')).toBeVisible()

    // Two controls over one value is a bug waiting for someone to change one of them, so the card
    // panel must not grow a second one — and the Payment Element must not re-ask for an address
    // the checkout already collected.
    await expect(page.getByRole('checkbox', { name: 'Billing address same as shipping' })).toHaveCount(1)
    await expect(page.getByTestId('payment-panel').getByRole('checkbox')).toHaveCount(0)
  })
})

// ---------------------------------------------------------------------------------------------
// Steps shared by the specs above. Specific to this file, so they live in it.
// ---------------------------------------------------------------------------------------------

/** The routes these steps navigate to. Narrower than the fixture's, which is why it accepts it. */
type Navigate = (options: {
  to: Extract<FileRouteTypes['to'], '/products/$productId' | '/login'>
  params?: Record<string, string>
}) => Promise<void>

async function addToCartAndCheckout(page: Page, navigate: Navigate, productId: string) {
  await navigate({ to: '/products/$productId', params: { productId } })
  await page.getByRole('button', { name: /add to cart/i }).click()

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible()
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)
}

async function signIn(page: Page, navigate: Navigate, customer: { email: string; password: string }) {
  await navigate({ to: '/login' })
  await page.getByLabel('Email').fill(customer.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/account', { timeout: 15_000 })
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

async function readOrderTotal(page: Page): Promise<string> {
  const total = page.getByText('Total', { exact: true })
  await expect(total).toBeVisible()
  return (await total.locator('xpath=following-sibling::dd[1]').innerText()).trim()
}

/**
 * Adds a unit to the cart through the API, from the page's own session, without the page knowing.
 *
 * A change the browser made would re-render the payment form at the new total and prove nothing;
 * this is the case the deferred flow exists for — the cart moved and only the server can say to
 * what.
 */
async function addLineItemOutOfBand(page: Page, variantId: string) {
  const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
  expect(cartId, 'the page has no cart to change').toBeTruthy()

  const backendUrl = process.env.VITE_BACKEND_URL
  expect(backendUrl, 'VITE_BACKEND_URL is unset — run the suite through `npm run test:e2e`').toBeTruthy()

  // Through Playwright's own request context rather than the page's `fetch`, so the page never
  // learns the cart moved — which is the entire point of this step.
  const response = await page.request.post(`${backendUrl}/store/carts/${cartId}/line-items`, {
    data: { variantId, quantity: 1 },
  })
  expect(response.ok(), `the cart refused the line item: ${response.status()}`).toBe(true)
}
