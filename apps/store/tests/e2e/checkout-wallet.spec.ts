import type { Page } from '@playwright/test'
import { FAKE_GATEWAY } from 'backend/test'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { useFakeStripe } from '../mocks/fake-gateway.js'
import { FAKE_CARDS } from '../mocks/fake-stripe-js.js'
import { storeApi } from '../mocks/store-api.js'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillShippingAddress } from '../setup/utils.js'
import {
  delayWalletReads,
  futureExpiry,
  lastMonthExpiry,
  refocusTab,
  signIn,
  thisMonthExpiry,
  walkBackToPaymentStep,
  walkToAccountWallet,
  walletSnapshot,
} from '../setup/wallet.js'

/**
 * Paying with a card the shopper already has.
 *
 * Every spec here operates on a list of near-identical rows, so the repo's "select the row you
 * created, never `.first()`" rule matters more than anywhere else: each card carries a `last4`
 * unique to its test and is selected by the accessible name built from it.
 *
 * The wallet is stubbed in front of each page — see `storeApi` for why, and for which half of each
 * claim is asserted in the backend suite instead. Parallel follows from that: a stub belongs to
 * one page, so no spec here can see another's cards.
 */
test.describe('Checkout — saved cards', () => {
  test.describe.configure({ timeout: 90_000 })

  test('the default card is pre-selected, and the card the shopper picks is the one charged', async ({
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

    // The default is deliberately not the first row, so "the default" and "the first one" cannot
    // both be satisfied by the same card.
    const chosen = storeApi.card({ last4: '1101', ...futureExpiry() })
    const preferred = storeApi.card({ brand: 'mastercard', last4: '1102', ...futureExpiry(), isDefault: true })
    await storeApi.stubWallet(page, [chosen, preferred])

    await signIn(page, customer)
    const sessions = storeApi.watchPaymentSessions(page)
    await reachPaymentStep(page, navigate, product.id, shipping.name)

    // Pre-selected on arrival: the default, not the first row and not the newest card.
    await expect(page.getByRole('radio', { name: 'Pay with Mastercard ending in 1102' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1101' })).not.toBeChecked()

    await page.getByRole('radio', { name: 'Pay with Visa ending in 1101' }).click()
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // The id the storefront sent is the one the shopper pressed — asserted against the *other*
    // card too, so a selector that always sent the default would fail here rather than pass by
    // coincidence. That the server charges that card and no other is
    // `saved-method-consent.api.test.ts`.
    const opened = await sessions.last()
    expect(opened?.sent.paymentMethodId).toBe(chosen.id)
    expect(opened?.sent.paymentMethodId).not.toBe(preferred.id)
  })

  test('an expired card is labelled, unselectable and skipped by auto-selection; one expiring this month is not', async ({
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

    // The expired card is the shopper's *default*, which is the case a naive "select the default"
    // gets wrong: they have one, and it is not the answer.
    await storeApi.stubWallet(page, [
      storeApi.card({ last4: '1201', ...lastMonthExpiry(), isDefault: true }),
      storeApi.card({ brand: 'mastercard', last4: '1202', ...thisMonthExpiry() }),
    ])

    await signIn(page, customer)
    await reachPaymentStep(page, navigate, product.id, shipping.name)

    const expired = page.getByRole('radio', { name: 'Pay with Visa ending in 1201' })
    const expiring = page.getByRole('radio', { name: 'Pay with Mastercard ending in 1202' })

    // Shown, because a shopper looking for a card they own should find it and be told why it is
    // unusable — not left wondering whether the store lost it.
    await expect(page.getByTestId('saved-card-row').filter({ hasText: '•••• 1201' })).toContainText('Expired')
    await expect(expired).toBeDisabled()
    await expect(expired).not.toBeChecked()

    // Expiring this month is a warning, not a refusal: the card works until the last day of it.
    await expect(page.getByTestId('saved-card-row').filter({ hasText: '•••• 1202' })).toContainText(
      'Expires this month',
    )
    await expect(expiring).toBeEnabled()
    await expect(expiring).toBeChecked()
  })

  test('auto-selection happens once: a refetch does not move a selection the shopper made', async ({
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

    const wallet = await storeApi.stubWallet(page, [
      storeApi.card({ last4: '1301', ...futureExpiry(), isDefault: true }),
      storeApi.card({ brand: 'mastercard', last4: '1302', ...futureExpiry() }),
    ])

    await signIn(page, customer)
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1301' })).toBeChecked()

    const shoppersChoice = page.getByRole('radio', { name: 'Pay with Mastercard ending in 1302' })
    await shoppersChoice.click()
    await expect(shoppersChoice).toBeChecked()

    // A third card arrives as the new default while they are looking at the step, and the tab
    // refocuses. Without the `autoSelected` guard the refetch re-runs auto-selection and quietly
    // moves the shopper onto a card they never picked — which is the bug this asserts against.
    wallet.add(storeApi.card({ brand: 'amex', last4: '1303', ...futureExpiry(), isDefault: true }))
    await refocusTab(page)

    // The refetch landed: the new card is on screen.
    await expect(page.getByRole('radio', { name: 'Pay with American Express ending in 1303' })).toBeVisible()
    // And it did not take the selection with it.
    await expect(shoppersChoice).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Pay with American Express ending in 1303' })).not.toBeChecked()
  })

  test('removing a card confirms inline, drops the row, and moves the selection to the next usable card', async ({
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

    const doomed = storeApi.card({ last4: '1401', ...futureExpiry(), isDefault: true })
    const kept = storeApi.card({ brand: 'mastercard', last4: '1402', ...futureExpiry() })
    const wallet = await storeApi.stubWallet(page, [doomed, kept])

    await signIn(page, customer)
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1401' })).toBeChecked()

    // Two steps, and the Remove control is a sibling of the label rather than inside it: a button
    // nested in a label fires the label's control on every click, so this press would otherwise
    // select the card it is about to delete.
    await page.getByRole('button', { name: 'Remove Visa ending in 1401' }).click()
    await expect(page.getByText('Remove Visa ending in 1401?')).toBeVisible()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()

    // The row is gone and the selection has moved to the next card they can pay with.
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1401' })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'Pay with Mastercard ending in 1402' })).toBeChecked()

    // Deleted, not merely hidden. Optimism about a *completed* detach is the rule here: the row is
    // dropped because the card is already gone, not in the hope that it will be.
    expect(wallet.cards.map((card) => card.id)).toEqual([kept.id])
  })

  test('a card removed elsewhere answers 409, and the wallet refetches back to the new-card form', async ({
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

    // A card the gateway no longer holds. The id is the instruction — see `FAKE_GATEWAY` — so the
    // `409` below is the backend's own, produced by the same 404 a real detached card gives, not
    // one this spec stubbed.
    const stale = storeApi.card({
      id: `${FAKE_GATEWAY.goneMethodPrefix}_1501`,
      last4: '1501',
      ...futureExpiry(),
      isDefault: true,
    })
    const wallet = await storeApi.stubWallet(page, [stale])

    await signIn(page, customer)
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1501' })).toBeChecked()

    // Removed in another tab while this one sat open: gone from the wallet, and the page has been
    // told nothing. It is still rendering the row, and must find out at the press.
    wallet.remove(stale.id)

    const conflict = page.waitForResponse(
      (response) => response.url().includes('/payment-sessions') && response.status() === 409,
    )
    await page.getByRole('button', { name: /place order/i }).click()
    await conflict

    // Told why, put back on a card they can actually enter, and left with no dead row to press
    // Place order on a second time.
    await expect(page.getByRole('alert')).toContainText('no longer available')
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1501' })).toHaveCount(0)
    await expect(page.getByTestId('payment-panel').getByTestId('fake-stripe-frame')).toBeVisible()

    // Still able to pay, on the same press-through: the recovery is not a dead end.
    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })
  })

  test('a wallet that will not load falls back to the card form with a notice, and the shopper still pays', async ({
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

    // The wallet read fails and nothing else does. A shopper who cannot see their saved cards must
    // still be able to buy the thing they came for.
    await storeApi.failWallet(page)

    await reachPaymentStep(page, navigate, product.id, shipping.name)

    // Waits out the one retry the wallet query allows itself, and no more: three would leave the
    // shopper looking at skeleton rows for seven seconds before the fallback they can use.
    await expect(page.getByText("We couldn't load your saved cards")).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('payment-panel').getByRole('radiogroup')).toHaveCount(0)

    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })
  })

  test('a shopper with nothing saved is offered the option, and their consent rides the one press', async ({
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

    // Nothing saved: the state that gets the new-card form, and the one the fake gateway cannot
    // produce on its own — it holds one card for every account holder that asks.
    await storeApi.stubWallet(page, [])

    await signIn(page, customer)

    const sessions = storeApi.watchPaymentSessions(page)
    await reachPaymentStep(page, navigate, product.id, shipping.name)

    // The consent control is gated on the session, not the wallet count — this shopper has nothing
    // saved and is precisely the one saving their first card.
    await page.getByRole('checkbox', { name: 'Save this card for next time' }).check()
    await fillCard(page, FAKE_CARDS.succeeds)
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    // The consent left the browser on the session that opened the intent — the one press, not a
    // later call, and not a second request the shopper could navigate away from between.
    //
    // What the server does with it is deliberately not asserted here: `setup_future_usage`, the
    // account holder it acts against, and marking the card redisplayable so the customer-scoped
    // listing does not filter it straight back out are all
    // `saved-method-consent.api.test.ts`. Reading them back through the fake gateway's wallet
    // would prove nothing either way — it answers with the same card whether or not one was
    // saved, so the assertion could not fail.
    const opened = await sessions.all()
    expect(opened).toHaveLength(1)
    expect(opened[0]?.sent.savePaymentMethod).toBe(true)
  })

  /**
   * The two surfaces, after the one operation that changes what a shopper owns.
   *
   * AC 8 is the ticket's central claim and the shared row component cannot carry it alone: the
   * disagreement lives below the components, in whether a removal wrote the list the other surface
   * reads. Both specs navigate client-side on purpose — a page load would discard the cache and
   * with it the thing being tested.
   */
  test('a card removed at checkout is gone on the account page, without a page load', async ({
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

    const survivor = storeApi.card({ brand: 'mastercard', last4: '1602', ...futureExpiry() })
    await storeApi.stubWallet(page, [storeApi.card({ last4: '1601', ...futureExpiry(), isDefault: true }), survivor])

    await signIn(page, customer)
    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await page.getByRole('button', { name: 'Remove Visa ending in 1601' }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 1601' })).toHaveCount(0)

    // Held open so the account page is judged on what it renders *from cache*, which is where the
    // two surfaces disagreed. Its own refetch corrects the render a moment later, and a retrying
    // assertion would happily wait for that and call it a pass.
    await delayWalletReads(page, 3_000)
    await walkToAccountWallet(page)

    await expect(page.getByTestId('saved-card-row')).not.toHaveCount(0)
    const onArrival = await walletSnapshot(page)
    expect(onArrival.map((row) => row.id)).toEqual([survivor.id])
  })

  test('a card removed at checkout stays gone on the way back, and nothing is selected onto it', async ({
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

    // The card about to be removed. Unbound: the assertions below name the survivor, so there is
    // nothing left to compare this one against.
    const survivor = storeApi.card({ brand: 'mastercard', last4: '1702', ...futureExpiry() })
    await storeApi.stubWallet(page, [storeApi.card({ last4: '1701', ...futureExpiry(), isDefault: true }), survivor])

    await signIn(page, customer)
    const sessions = storeApi.watchPaymentSessions(page)

    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await page.getByRole('button', { name: 'Remove Visa ending in 1701' }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()
    await expect(page.getByRole('radio', { name: 'Pay with Mastercard ending in 1702' })).toBeChecked()

    // Leave and come back. The selector remounts with no memory of the removal, so the only thing
    // standing between the shopper and the card they just deleted is the shared cache.
    await delayWalletReads(page, 3_000)
    await walkBackToPaymentStep(page)
    await fillDeliveryAndChooseStripe(page, shipping.name)

    // Sampled once, while the wallet read is still held open: this is what the step renders from
    // cache, before any refetch can tidy it up. The removed card must not be there at all — and
    // `autoSelected` latches on the first render, so a card that is merely corrected away a moment
    // later has already become the id Place order would send.
    await expect(page.getByTestId('saved-card-row')).not.toHaveCount(0)
    const onArrival = await walletSnapshot(page)
    expect(onArrival.map((row) => row.id)).toEqual([survivor.id])
    expect(onArrival.filter((row) => row.checked).map((row) => row.id)).toEqual([survivor.id])

    // And the step is one they can actually pay from: something is selected, and it is the card
    // that still exists. The end state of the bug was no row checked and no card form either — a
    // payment step whose only outcome was a `409`.
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 20_000 })

    expect((await sessions.last())?.sent.paymentMethodId).toBe(survivor.id)
  })
})

// ---------------------------------------------------------------------------------------------
// Steps shared by the specs above. Specific to this file, so they live in it.
// ---------------------------------------------------------------------------------------------

type Navigate = (options: {
  to: Extract<FileRouteTypes['to'], '/products/$productId'>
  params?: Record<string, string>
}) => Promise<void>

/** From an empty cart to a rendered payment step, which is where every spec here starts. */
async function reachPaymentStep(page: Page, navigate: Navigate, productId: string, shippingName: string) {
  await navigate({ to: '/products/$productId', params: { productId } })
  await page.getByRole('button', { name: /add to cart/i }).click()

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible()
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)

  await fillDeliveryAndChooseStripe(page, shippingName)
}

/**
 * The checkout's own steps, from a freshly mounted form to a rendered payment step.
 *
 * Its own function because a shopper who leaves the checkout and comes back is handed an empty
 * address form — the cart holds the address, the form does not restore it — so the return leg has
 * to walk the same steps rather than pick up where it left off.
 */
async function fillDeliveryAndChooseStripe(page: Page, shippingName: string) {
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
