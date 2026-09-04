import { faker } from '@faker-js/faker'
import { BACKEND_TIMEOUT } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, placeOrder } from '../setup/utils.js'

/**
 * Routing is only observable through a real browser against a real server: the redirect is an HTTP
 * response, the language attribute is on the document the server wrote, and the not-found is a
 * status code. None of it exists below this seam.
 *
 * The markets are the seeded ones — United States in `en-US` and Colombia in `es-CO` — because the
 * routable segments are whichever countries the store sells to, not a list the storefront carries.
 */
const DEFAULT_MARKET = 'en-US'
const SECOND_MARKET = 'es-CO'

test.describe('Markets', () => {
  test('both markets render the storefront under their own locale code', async ({ page }) => {
    for (const localeCode of [DEFAULT_MARKET, SECOND_MARKET]) {
      const response = await page.goto(`/${localeCode}`, { waitUntil: 'networkidle' })
      expect(response?.status(), `GET /${localeCode}`).toBe(200)

      // The storefront, not a shell: the header is what every page of it carries.
      await expect(page.locator('header').getByText('Proteus')).toBeVisible()
      // The locale code is the language tag, so the document says which market it is.
      await expect(page.locator('html')).toHaveAttribute('lang', localeCode)
    }
  })

  test('the root is a router: it redirects to the default market and renders nothing itself', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    // The default market is prefixed like every other one. If `/` rendered instead, the same
    // storefront would answer at two addresses.
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}`)
    await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_MARKET)
  })

  test('a path with no market keeps its route and gains the prefix', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })

    // A real route missing its market is a shopper to be placed, not a wrong address.
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}/login`)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('an unknown locale code is a not-found at its own address', async ({ page }) => {
    const response = await page.goto('/fr-FR')

    // Both halves matter, and the second is the one that is easy to lose: a market asked for by
    // name that the store does not sell in has nowhere to be redirected to. Answering at
    // `/en-US/fr-FR` would move the not-found off the address the shopper typed and mint a second
    // URL for the same nothing.
    expect(response?.status()).toBe(404)
    await expect(page).toHaveURL('/fr-FR')
  })

  test('the market chosen by URL is remembered, and the root resolves to it', async ({ page }) => {
    // Choosing a market by its URL is what persists it.
    await page.goto(`/${SECOND_MARKET}`, { waitUntil: 'networkidle' })
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // A later visit to the root lands back on it rather than on the default, and lands there by
    // redirect: the URL carries the market, so the address stays shareable.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(`/${SECOND_MARKET}`)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // And the market survives a client-side navigation rather than being dropped on the first
    // one. This is the assertion the whole slice rests on: the rewrite has to hold after
    // hydration, where the router — not the server — is writing the URL.
    await page.locator('header').getByLabel('Search products').click()
    await expect(page).toHaveURL(`/${SECOND_MARKET}?modal=search`)
    await expect(page.locator('[data-slot="drawer-popup"]')).toBeVisible()
  })
})

/**
 * The control, and what a shopper reads once they have used it.
 *
 * Every assertion here is on what is on the page — the options, the address, the amount — and
 * never on which parameter went over the wire. `countryCode` reaching the backend is only
 * interesting because a peso amount comes back, so the peso amount is the claim.
 */
test.describe('Market control', () => {
  test('lists exactly the markets the store sells in', async ({ page }) => {
    await page.goto(`/${DEFAULT_MARKET}`, { waitUntil: 'networkidle' })

    // The seeded markets, sorted by display name the way the country endpoint returns them.
    // Exhaustive on purpose: a control offering a market the store does not sell in quotes a
    // currency nobody configured, and it is this list that would have to grow for that to happen.
    await expect(page.locator('footer').getByLabel('Market').locator('option')).toHaveText([
      'Colombia',
      'United States',
    ])
  })

  test('switches market as a document navigation, keeping the path and its search', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    const term = faker.string.alpha({ length: 10, casing: 'lower' })
    await using product = await factories.create.product({ status: 'published', title: `${term} tee` })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/', search: { q: term } })
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}?q=${term}`)

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)

    // The same page, in the other market: the search survives the switch, so a shopper does not
    // lose what they were looking at to change where they are buying from.
    await expect(page).toHaveURL(`/${SECOND_MARKET}?q=${term}`)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)
    await expect(page.locator('main').getByRole('heading', { level: 3, name: product.title })).toBeVisible()

    // And the choice is persisted, which is what the cookie the switch writes is for: a later
    // visit to the root lands in the market that was chosen rather than the default.
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page).toHaveURL(`/${SECOND_MARKET}`)
  })

  test('quotes each market its own currency, punctuated the way that market writes it', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    const term = faker.string.alpha({ length: 10, casing: 'lower' })
    // Priced in both currencies, and the peso price is not the dollar price: 100000 could not be
    // 25.00 relabelled, so the amount itself says which market the backend priced the request in.
    await using product = await factories.create.productWithPricing({
      product: { title: `${term} tee` },
      prices: [
        { amount: '25.00', currencyCode: 'usd' },
        { amount: '100000', currencyCode: 'cop' },
      ],
    })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/', search: { q: term } })

    const card = page.locator('main').getByRole('link').filter({ hasText: product.title })
    await expect(card).toContainText('$25.00')

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)
    await expect(page).toHaveURL(`/${SECOND_MARKET}?q=${term}`)

    // Colombian grouping — a dot where the American form puts a comma — around the peso amount,
    // and no `COP` anywhere: `en-US` renders this same price as `COP 100,000`, which is the bare
    // currency code a shopper should never be shown.
    await expect(card).toContainText('100.000')
    await expect(card).not.toContainText('COP')
    await expect(card).not.toContainText('25')

    // The detail page prices the same way, off its own request rather than the list's — the two
    // are separate queries and only one of them has been proven to carry the market so far.
    await page.goto(`/${SECOND_MARKET}/products/${product.id}`, { waitUntil: 'networkidle' })
    const price = page.locator('main').getByText(/100\.000/)
    await expect(price).toBeVisible()
    await expect(price).toContainText('$')
    await expect(page.locator('main')).not.toContainText('COP')
  })

  test('a cart is still the shopper’s after they change market', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({
      prices: [
        { amount: '25.00', currencyCode: 'usd' },
        { amount: '100000', currencyCode: 'cop' },
      ],
    })
    await authenticate({ as: 'customer' })
    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel.getByText(product.title)).toBeVisible()
    await page.keyboard.press('Escape')

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // The bag still carries what was put in it. Repricing the cart into the new market is the
    // next slice's job — this one only has to not lose the cart on the way across.
    //
    // The badge first, and not only because it is the claim: it is the cart request resolving,
    // which means the page has hydrated and the button below is a button rather than markup.
    const bag = page.locator('header').getByLabel('Cart')
    await expect(bag).toContainText('1')

    await bag.click()
    await expect(cartPanel.getByText(product.title)).toBeVisible()
  })
})

/**
 * Dates, which are the other half of what a market punctuates and the half a shopper is most
 * likely to misread: `5/01/2026` and `Jan 5, 2026` are the same day, and `1/05/2026` is not.
 *
 * Its own block because it needs an order, and the checkout workflow is the only thing that
 * writes one — so this drives the whole flow through the UI, which is slow.
 */
test.describe('Market dates', () => {
  test.describe.configure({ timeout: 60_000 })

  test('writes an order’s date the way the market writes dates', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()
    await authenticate({ as: 'customer' })
    disposeCartAfterTest(page, factories, cleanup)

    // Placed in the default market, because the address and the shipping zone are American. The
    // order is the fixture here; the market it is *read* in is what this test is about.
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    await page
      .locator('[data-slot="drawer-popup"]')
      .getByRole('link', { name: /checkout/i })
      .click()
    const displayId = await placeOrder(page, shipping.name)

    await navigate({ to: '/account' })
    const orderRow = page.getByRole('link', { name: new RegExp(`#${displayId}\\b`) })
    await expect(orderRow).toBeVisible({ timeout: BACKEND_TIMEOUT })
    // Month first and spelled out — the American form.
    await expect(orderRow).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)
    await expect(page).toHaveURL(`/${SECOND_MARKET}/account`)

    // The same order, day first and numeric — and no longer anything an American reader could
    // mistake for a month.
    const switchedRow = page.getByRole('link', { name: new RegExp(`#${displayId}\\b`) })
    await expect(switchedRow).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(switchedRow).toContainText(/\d{1,2}\/\d{2}\/\d{4}/)
    await expect(switchedRow).not.toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)
  })
})
