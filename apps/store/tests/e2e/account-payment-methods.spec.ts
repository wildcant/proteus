import type { Page } from '@playwright/test'
import type { FileRouteTypes } from '../../src/routeTree.gen'
import { gatewayCustomerFor, gatewayWalletFor, seedSavedCard, useFakeStripe } from '../mocks/fake-gateway.js'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillShippingAddress } from '../setup/utils.js'
import { futureExpiry, openAccountWallet, renderedCardIds, signIn } from '../setup/wallet.js'

/**
 * The account wallet, and the one thing it must never do: disagree with the checkout.
 *
 * Two lists of cards that could differ is the failure mode the shared row component exists to
 * prevent, so the ordering spec below asserts across both surfaces in one test rather than
 * asserting each in isolation and hoping.
 */
test.describe('Account — payment methods', () => {
  // Parallel: nothing here reads the gateway's shared call log, and every card is seeded with a
  // `last4` unique to its own test. Serialising would only cost failure isolation.
  test.describe.configure({ timeout: 90_000 })

  test('a customer with nothing saved is told where cards come from, not offered a form', async ({
    page,
    factories,
  }) => {
    await using customer = await factories.create.customer({ hasAccount: true })

    await signIn(page, customer)
    await page.goto('/account/payment-methods')

    await expect(page.getByRole('heading', { name: 'No saved cards' })).toBeVisible({ timeout: 15_000 })
    // No card entry here on purpose: adding a card outside a purchase means a SetupIntent flow,
    // which is its own feature. The empty state points at the only thing that does save one.
    await expect(page.getByText(/saved at checkout/i)).toBeVisible()
    await expect(page.getByRole('textbox')).toHaveCount(0)
  })

  test('both surfaces list the same cards in the same order, rendered by one row component', async ({
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
    const gatewayCustomer = await openAccountWallet(page, customer.id)

    // Seeded oldest first with the default in the middle, so neither "as stored" nor "newest
    // first" alone produces the expected order — only "default first, then most recent" does.
    const oldest = await seedSavedCard(gatewayCustomer.id, { last4: '2101', ...futureExpiry() })
    const theDefault = await seedSavedCard(gatewayCustomer.id, {
      brand: 'mastercard',
      last4: '2102',
      ...futureExpiry(),
      isDefault: true,
    })
    const newest = await seedSavedCard(gatewayCustomer.id, { brand: 'amex', last4: '2103', ...futureExpiry() })

    await page.reload()
    await expect(page.getByRole('radio', { name: /ending in 2101/ })).toBeVisible({ timeout: 15_000 })
    const inAccount = await renderedCardIds(page)
    expect(inAccount).toEqual([theDefault.id, newest.id, oldest.id])

    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 2101' })).toBeVisible()
    const inCheckout = await renderedCardIds(page)

    // Same rows, same order. The order comes from the backend and neither surface re-sorts it.
    expect(inCheckout).toEqual(inAccount)
  })

  test('a default set from the account page is the card the next checkout starts on', async ({
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
    const gatewayCustomer = await openAccountWallet(page, customer.id)

    await seedSavedCard(gatewayCustomer.id, { last4: '2201', ...futureExpiry(), isDefault: true })
    const nominated = await seedSavedCard(gatewayCustomer.id, {
      brand: 'mastercard',
      last4: '2202',
      ...futureExpiry(),
    })

    await page.reload()
    await page.getByRole('radio', { name: 'Make Mastercard ending in 2202 the default' }).click()

    // The route answers with the reordered wallet, so the nominated card moves to the top without
    // a second round trip.
    await expect(page.getByRole('radio', { name: /Mastercard ending in 2202, your default card/ })).toBeChecked()

    // And the default lives at the gateway, on the field Stripe itself treats as one — no Proteus
    // table, no migration, and nothing that could disagree with it.
    await expect
      .poll(async () => (await gatewayCustomerFor(customer.id)).invoice_settings.default_payment_method, {
        timeout: 10_000,
      })
      .toBe(nominated.id)

    await reachPaymentStep(page, navigate, product.id, shipping.name)
    await expect(page.getByRole('radio', { name: 'Pay with Mastercard ending in 2202' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Pay with Visa ending in 2201' })).not.toBeChecked()
  })

  test('removing a card from the account page confirms inline and detaches it at the gateway', async ({
    page,
    factories,
  }) => {
    await using customer = await factories.create.customer({ hasAccount: true })

    await signIn(page, customer)
    const gatewayCustomer = await openAccountWallet(page, customer.id)

    const doomed = await seedSavedCard(gatewayCustomer.id, { last4: '2301', ...futureExpiry(), isDefault: true })
    await seedSavedCard(gatewayCustomer.id, { brand: 'mastercard', last4: '2302', ...futureExpiry() })

    await page.reload()
    await expect(page.getByRole('radio', { name: /ending in 2301/ })).toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'Remove Visa ending in 2301' }).click()
    await expect(page.getByText('Remove Visa ending in 2301?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep' }).click()

    // Keeping is the first of the two steps doing its job: the card is still there.
    await expect(page.getByRole('radio', { name: /ending in 2301/ })).toBeVisible()

    await page.getByRole('button', { name: 'Remove Visa ending in 2301' }).click()
    await page.getByRole('button', { name: 'Remove', exact: true }).click()

    await expect(page.getByRole('radio', { name: /ending in 2301/ })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: /ending in 2302/ })).toBeVisible()

    await expect
      .poll(async () => (await gatewayWalletFor(gatewayCustomer.id)).map((method) => method.id))
      .not.toContain(doomed.id)
  })

  test('the Remove control is not nested inside the selectable label', async ({ page, factories }) => {
    await using customer = await factories.create.customer({ hasAccount: true })

    await signIn(page, customer)
    const gatewayCustomer = await openAccountWallet(page, customer.id)
    await seedSavedCard(gatewayCustomer.id, { last4: '2401', ...futureExpiry(), isDefault: true })

    await page.reload()
    const remove = page.getByRole('button', { name: 'Remove Visa ending in 2401' })
    await expect(remove).toBeVisible({ timeout: 15_000 })

    // A button inside a label fires the label's control on every click. Asserted structurally
    // rather than through behaviour, because the behaviour it produces — the row selecting itself
    // on the way to being deleted — is indistinguishable from a deliberate selection.
    expect(await remove.evaluate((button) => button.closest('label') !== null)).toBe(false)
  })
})

// ---------------------------------------------------------------------------------------------
// Steps shared by the specs above. Specific to this file, so they live in it.
// ---------------------------------------------------------------------------------------------

type Navigate = (options: {
  to: Extract<FileRouteTypes['to'], '/products/$productId'>
  params?: Record<string, string>
}) => Promise<void>

/** From an empty cart to a rendered payment step. */
async function reachPaymentStep(page: Page, navigate: Navigate, productId: string, shippingName: string) {
  await navigate({ to: '/products/$productId', params: { productId } })
  await page.getByRole('button', { name: /add to cart/i }).click()

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible()
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)

  await fillShippingAddress(page)

  const shipping = page.getByRole('radio', { name: shippingName })
  await expect(shipping).toBeVisible({ timeout: 15_000 })
  await shipping.click()
  await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 15_000 })

  const provider = page.getByRole('radio', { name: 'Stripe' })
  await expect(provider).toBeVisible({ timeout: 15_000 })
  await provider.click()
  await expect(page.getByTestId('payment-panel')).toBeVisible({ timeout: 15_000 })
}
