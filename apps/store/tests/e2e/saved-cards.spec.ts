import type { Page } from '@playwright/test'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { useFakeStripe } from '../mocks/fake-gateway.js'
import { FAKE_CARDS } from '../mocks/fake-stripe-js.js'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillShippingAddress, signIn } from '../setup/utils.js'

/**
 * A shopper's saved cards, across the two surfaces that show them.
 *
 * Nothing here is stubbed. The wallet is arranged by *shopping* — a saved card exists because a
 * checkout saved it — so every assertion runs through the real route, the real module service, the
 * real ordering rule and the real ownership check at the gateway. The predecessor to this file
 * stubbed our own `GET /store/payment-methods` in the browser, which meant a green run proved only
 * that React can render an array it was handed.
 *
 * Two long journeys rather than thirteen short ones, and the two are not a stylistic choice: an
 * e2e arrange phase is a browser, a sign-in, a cart and a checkout, and paying that thirteen times
 * to assert thirteen single facts is what made stubbing look necessary in the first place.
 *
 * What is deliberately *not* here:
 *
 * - **Which card was charged.** `payment-details.tsx` renders no brand and no last four, on
 *   purpose — the order module stores no instrument. It has no visual surface, so it is asserted
 *   in `saved-method-consent.api.test.ts` where the gateway is observable.
 * - **Wallets of several distinct cards** — ordering, a default among many, expiry labelling. The
 *   browser's fake Stripe.js and the server's fake gateway cannot talk (the storefront's adapter
 *   hands the server an intent id and nothing else), so shopping can only ever produce one
 *   indistinguishable card. Ordering is `payment-method.api.test.ts`; the row's own rendering is
 *   `saved-card-row.browser.test.tsx`.
 */
test.describe('Saved cards', () => {
  test.describe.configure({ timeout: 120_000 })

  test('a shopper saves their first card at checkout, pays with it again, and removes it', async ({
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
    await signIn(page, customer)

    // 1 · Nothing saved. Reachable at all only because the gateway now holds a wallet per account
    // holder — the old fake handed every shopper the same canned card, so this state could not be
    // produced and the spec that wanted it stubbed the route instead.
    await page.goto('/account/payment-methods')
    await expect(page.getByRole('heading', { name: 'No saved cards' })).toBeVisible({ timeout: 15_000 })

    // No card entry here on purpose: adding a card outside a purchase is a SetupIntent flow and its
    // own feature. The empty state points at the only thing that does save one.
    await expect(page.getByText(/saved at checkout/i)).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)

    // 2 · The one thing that saves a card. The consent control is gated on the session rather than
    // on the wallet count, and this shopper — with nothing saved — is precisely the one saving
    // their first card.
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await page.getByRole('checkbox', { name: 'Save this card for next time' }).check()
    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 30_000 })

    // 3 · The consent was honoured, and the card is on the account page. This is the assertion the
    // stub could never make: it reads back through our own route from the gateway the checkout
    // actually wrote to.
    await page.goto('/account/payment-methods')
    await expect(page.getByRole('radio', { name: /Visa ending in 4242/ })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'No saved cards' })).toHaveCount(0)

    // 4 · Waiting at the next checkout, already chosen, with no card form to fill.
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    const saved = page.getByRole('radio', { name: 'Pay with Visa ending in 4242' })
    await expect(saved).toBeVisible({ timeout: 15_000 })
    await expect(saved).toBeChecked()

    // 5 · Removed from the checkout, in two presses, and the first can be taken back.
    await page.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
    await expect(page.getByText('Remove Visa ending in 4242?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep' }).click()
    await expect(saved).toBeVisible()

    await page.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()

    // The row goes, and the step falls back to something the shopper can still pay with — the end
    // state of the bug this guards was no row and no form either, a payment step whose only
    // outcome was a 409.
    await expect(saved).toHaveCount(0)
    await expect(page.getByTestId('payment-panel').getByTestId('fake-stripe-frame')).toBeVisible()

    // 6 · Detached at the gateway, not merely hidden in one tab's cache: the account page is a
    // fresh read and agrees.
    await page.goto('/account/payment-methods')
    await expect(page.getByRole('heading', { name: 'No saved cards' })).toBeVisible({ timeout: 15_000 })
  })

  test('a card removed in another tab is refused at the press, and the shopper still pays', async ({
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
    await signIn(page, customer)

    // Arrange by shopping: this is the only thing that puts a card in a wallet.
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await page.getByRole('checkbox', { name: 'Save this card for next time' }).check()
    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 30_000 })

    // A second checkout, on a fresh visit — which is how a shopper comes back to buy again, and
    // which is also the only way this tab learns about the card it just saved. Staying inside the
    // SPA leaves the wallet query serving the empty list it cached at the first checkout; that is
    // its own question, and not the one this journey is asking.
    await page.goto('/')
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 4242' })).toBeChecked({ timeout: 15_000 })

    // The other tab. A real second page in the same context, so it carries the same session and
    // removes the card at the same gateway — the scenario as a shopper produces it, rather than a
    // magic id the fake was told to refuse.
    const otherTab = await page.context().newPage()
    await otherTab.goto('/account/payment-methods')
    await otherTab.getByRole('button', { name: 'Remove Visa ending in 4242' }).click()
    await otherTab.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(otherTab.getByRole('heading', { name: 'No saved cards' })).toBeVisible({ timeout: 15_000 })
    await otherTab.close()

    // The first tab has been told nothing. It is still rendering the row and must find out at the
    // press — which is the only place a shopper ever would.
    await page.getByRole('button', { name: /place order/i }).click()

    // Told why, put back on a card they can actually enter, and left with no dead row to press
    // Place order on a second time.
    await expect(page.getByRole('alert')).toContainText('no longer available', { timeout: 20_000 })
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 4242' })).toHaveCount(0)
    await expect(page.getByTestId('payment-panel').getByTestId('fake-stripe-frame')).toBeVisible()

    // Still able to pay, on the same press-through: the recovery is not a dead end.
    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 30_000 })
  })
})

// ---------------------------------------------------------------------------------------------
// Steps shared by the journeys above. Specific to this file, so they live in it.
// ---------------------------------------------------------------------------------------------

type Navigate = (options: {
  to: Extract<FileRouteTypes['to'], '/products/$productId'>
  params?: Record<string, string>
}) => Promise<void>

/** From an empty cart to a rendered payment step, which is where both journeys do their work. */
async function reachPaymentStep(page: Page, navigate: Navigate, productId: string, shippingName: string) {
  await navigate({ to: '/products/$productId', params: { productId } })

  const addToCart = page.getByRole('button', { name: /add to cart/i })
  await expect(addToCart).toBeEnabled({ timeout: 30_000 })
  await addToCart.click()

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible({ timeout: 30_000 })
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/, { timeout: 30_000 })

  await fillShippingAddress(page)

  // By name, never `.first()`: specs run in parallel and each creates its own US option.
  const shipping = page.getByRole('radio', { name: shippingName })
  await expect(shipping).toBeVisible({ timeout: 15_000 })
  await shipping.click()
  await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 15_000 })

  const provider = page.getByRole('radio', { name: 'Stripe' })
  await expect(provider).toBeVisible({ timeout: 15_000 })
  await provider.click()
  await expect(page.getByTestId('payment-panel')).toBeVisible({ timeout: 15_000 })
}

/** Types into the gateway's own frame, which is where a card is entered at the real gateway too. */
async function fillCard(page: Page, number: string) {
  await page.frameLocator('[data-testid="fake-stripe-frame"]').getByLabel('Card number').fill(number)
}
