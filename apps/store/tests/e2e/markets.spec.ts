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

    // The bag still carries what was put in it — the claim this test owns. What the bag is
    // *priced* in after the crossing is the subject of `Cart across markets` below.
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

/**
 * The bag itself crossing a market boundary.
 *
 * A cart carries the currency of the market it was opened in, and the page around it quotes the
 * market it is in — so a cart left behind is two currencies on one screen and an order taken at
 * the wrong one. None of that is visible below a real browser: the cart id lives in the browser's
 * own storage, and the crossing is a document navigation.
 */
test.describe('Cart across markets', () => {
  test.describe.configure({ timeout: 60_000 })

  test('reprices the bag into the market the shopper switched to', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    // Priced in both, and the peso price is not the dollar price relabelled — so the number in the
    // bag afterwards says which currency it was read from.
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
    await expect(cartPanel).toContainText('$25.00')
    await page.keyboard.press('Escape')

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    const bag = page.locator('header').getByLabel('Cart')
    await expect(bag).toContainText('1', { timeout: BACKEND_TIMEOUT })
    await bag.click()

    // One currency on the screen. The dollar amount is the whole defect: a bag quoting it beside
    // a catalogue quoting pesos is an order that completes at the price nobody was shown.
    await expect(cartPanel).toContainText('100.000', { timeout: BACKEND_TIMEOUT })
    await expect(cartPanel).not.toContainText('25.00')
  })

  test('crosses on a market URL opened directly, not only through the control', async ({
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
    await expect(page.locator('[data-slot="drawer-popup"]')).toContainText('$25.00')

    // A shared link or a bookmark: the shopper arrives in the other market without ever touching
    // the control, carrying the same cart in their browser's storage.
    await page.goto(`/${SECOND_MARKET}`, { waitUntil: 'networkidle' })

    const bag = page.locator('header').getByLabel('Cart')
    await expect(bag).toContainText('1', { timeout: BACKEND_TIMEOUT })
    await bag.click()
    await expect(page.locator('[data-slot="drawer-popup"]')).toContainText('100.000', { timeout: BACKEND_TIMEOUT })
  })

  test('names what cannot be sold in the new market rather than dropping it', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    // Dollars only: there is no peso price for this line to move to, which is the one thing that
    // makes the whole switch impossible rather than merely different.
    await using product = await factories.create.productWithPricing({
      prices: [{ amount: '25.00', currencyCode: 'usd' }],
    })
    await authenticate({ as: 'customer' })
    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.locator('[data-slot="drawer-popup"]')).toContainText('$25.00')
    await page.keyboard.press('Escape')

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)

    // Told, by name, and told what the bag is still in — the shopper is standing in a market
    // their cart is not in, and nothing about the page would otherwise say so.
    const notice = page.getByRole('alert')
    await expect(notice).toContainText(product.title, { timeout: BACKEND_TIMEOUT })
    await expect(notice).toContainText('COP')
    await expect(notice).toContainText('USD')

    // The way out the notice offers points at the market the bag is priced for, so leaving is one
    // click rather than a hunt through the control for whichever market that was.
    await expect(notice.getByRole('link', { name: /United States/ })).toHaveAttribute(
      'href',
      new RegExp(`^/${DEFAULT_MARKET}`),
    )

    // And nothing was silently dropped on the way: the bag is exactly as they left it.
    await page.locator('header').getByLabel('Cart').click()
    await expect(page.locator('[data-slot="drawer-popup"]')).toContainText(product.title)
  })

  test('crosses on its own once the thing that blocked it is out of the bag', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    await using blocked = await factories.create.productWithPricing({
      prices: [{ amount: '25.00', currencyCode: 'usd' }],
    })
    await using sellable = await factories.create.productWithPricing({
      prices: [
        { amount: '40.00', currencyCode: 'usd' },
        { amount: '160000', currencyCode: 'cop' },
      ],
    })
    await authenticate({ as: 'customer' })
    disposeCartAfterTest(page, factories, cleanup)

    for (const product of [sellable, blocked]) {
      await navigate({ to: '/products/$productId', params: { productId: product.id } })
      await page.getByRole('button', { name: /add to cart/i }).click()
      await expect(page.locator('[data-slot="drawer-popup"]').getByText(product.title)).toBeVisible()
      await page.keyboard.press('Escape')
    }

    await page.locator('footer').getByLabel('Market').selectOption(SECOND_MARKET)
    await expect(page.getByRole('alert')).toContainText(blocked.title, { timeout: BACKEND_TIMEOUT })

    // The refusal is not a dead end. Taking out the thing this market cannot sell is the shopper's
    // own way through it, and the storefront has to notice: the bag it asked about has changed, so
    // the same switch is worth asking for again without them touching the control a second time.
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await page.locator('header').getByLabel('Cart').click()
    await cartPanel.getByRole('button', { name: `Remove ${blocked.title}` }).click()

    await expect(page.getByRole('alert')).toBeHidden({ timeout: BACKEND_TIMEOUT })
    await expect(cartPanel).toContainText('160.000', { timeout: BACKEND_TIMEOUT })
    await expect(cartPanel).not.toContainText('40.00')
  })
})
