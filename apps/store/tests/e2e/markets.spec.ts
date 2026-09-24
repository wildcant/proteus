import { faker } from '@faker-js/faker'
import type { Page } from '@playwright/test'
import { BACKEND_TIMEOUT } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'
import { DEFAULT_MARKET, disposeCartAfterTest, placeOrder } from '../setup/utils.js'

/**
 * Routing is only observable through a real browser against a real server: the redirect is an HTTP
 * response, the language attribute is on the document the server wrote, and the not-found is a
 * status code. None of it exists below this seam.
 *
 * The markets are the seeded ones — United States in `en-US` and Colombia in `es-CO` — because the
 * routable segments are whichever countries the store sells to, not a list the storefront carries.
 */
const SECOND_MARKET = 'es-CO'
/** How the second market is listed. The control names markets the way a shopper reads them. */
const SECOND_MARKET_NAME = 'Colombia'

/** The footer's market control, opened. A menu rather than a `<select>`, so its rows are on the
 *  page only while it is open — every assertion about them opens it first. */
function openMarketMenu(page: Page) {
  return page
    .locator('footer')
    .getByRole('button', { name: /^Market:/ })
    .click()
}

/** Switches market by name, which is the only thing a row shows. */
async function switchMarket(page: Page, displayName: string) {
  await openMarketMenu(page)
  await page.getByRole('menuitem', { name: displayName }).click()
}

test.describe('Markets', () => {
  test('both markets render the storefront under their own locale code', async ({ page, goto }) => {
    for (const localeCode of [DEFAULT_MARKET, SECOND_MARKET]) {
      const response = await goto(`/${localeCode}`)
      expect(response?.status(), `GET /${localeCode}`).toBe(200)

      // The storefront, not a shell: the header is what every page of it carries.
      await expect(page.locator('header').getByText('Proteus')).toBeVisible()
      // The locale code is the language tag, so the document says which market it is.
      await expect(page.locator('html')).toHaveAttribute('lang', localeCode)
    }
  })

  test('each market renders its own language on the server, and the client keeps it', async ({ page, goto }) => {
    const hydrationErrors: Array<string> = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat/i.test(message.text())) hydrationErrors.push(message.text())
    })
    const backendUrl = process.env.VITE_BACKEND_URL
    expect(
      backendUrl,
      'VITE_BACKEND_URL is unset — run the suite through `pnpm --filter store run test:e2e`',
    ).toBeTruthy()
    const apiLocales: Array<string | undefined> = []
    page.on('request', (request) => {
      if (backendUrl && request.url().startsWith(backendUrl) && request.method() !== 'OPTIONS') {
        apiLocales.push(request.headers()['x-proteus-locale'])
      }
    })

    const year = new Date().getFullYear()
    const copyrights = [
      [SECOND_MARKET, `© ${year} Proteus. Todos los derechos reservados.`],
      [DEFAULT_MARKET, `© ${year} Proteus. All rights reserved.`],
    ] as const

    for (const [localeCode, copyright] of copyrights) {
      apiLocales.length = 0
      const response = await goto(`/${localeCode}`)

      // In the server's HTML, not only after hydration: a crawler reads the document as sent.
      expect(await response?.text()).toContain(copyright)
      await expect(page.locator('footer').getByText(copyright)).toBeVisible()
      // Every request the page makes to the API names the market's locale, so API Messages match.
      // The server hands its data to the client, so the page may not fetch on its own; re-sorting
      // the catalogue makes the hydrated client ask. Its answer is awaited so no request from this
      // page is still in flight when the next market's page starts counting.
      const catalogue = `${backendUrl}/store/products`
      const resorted = page.waitForResponse(
        (r) => r.url().startsWith(catalogue) && !r.url().includes('order=-createdAt'),
      )
      await page.locator('main').getByRole('combobox').selectOption({ index: 1 })
      await resorted
      expect(apiLocales.length).toBeGreaterThan(0)
      expect(new Set(apiLocales)).toEqual(new Set([localeCode]))
    }

    expect(hydrationErrors).toEqual([])
  })

  test('the root is a router: it redirects to the default market and renders nothing itself', async ({
    page,
    goto,
  }) => {
    await goto('/')

    // The default market is prefixed like every other one. If `/` rendered instead, the same
    // storefront would answer at two addresses.
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}`)
    await expect(page.locator('html')).toHaveAttribute('lang', DEFAULT_MARKET)
  })

  test('off the edge, a first visit with no geo-IP country still lands on the default market', async ({
    page,
    goto,
  }) => {
    // Cloudflare's country is the only thing that sends a first visit elsewhere, and a local server
    // has neither `cf` nor `CF-IPCountry`. No cookie either, so nothing is left but the default.
    await page.context().clearCookies()
    const response = await goto('/')

    expect(response?.request().redirectedFrom()?.url(), 'the root answers by redirect').toMatch(/\/$/)
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}`)
  })

  test('a path with no market keeps its route and gains the prefix', async ({ page, goto }) => {
    await goto('/login')

    // A real route missing its market is a shopper to be placed, not a wrong address.
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}/login`)
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('an unknown locale code is a not-found at its own address', async ({ page, goto }) => {
    const response = await goto('/fr-FR')

    // Both halves matter, and the second is the one that is easy to lose: a market asked for by
    // name that the store does not sell in has nowhere to be redirected to. Answering at
    // `/en-US/fr-FR` would move the not-found off the address the shopper typed and mint a second
    // URL for the same nothing.
    expect(response?.status()).toBe(404)
    await expect(page).toHaveURL('/fr-FR')
  })

  test('the market chosen by URL is remembered, and the root resolves to it', async ({ page, goto }) => {
    // Choosing a market by its URL is what persists it.
    await goto(`/${SECOND_MARKET}`)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // A later visit to the root lands back on it rather than on the default, and lands there by
    // redirect: the URL carries the market, so the address stays shareable.
    await goto('/')
    await expect(page).toHaveURL(`/${SECOND_MARKET}`)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // And the market survives a client-side navigation rather than being dropped on the first
    // one. This is the assertion the whole slice rests on: the rewrite has to hold after
    // hydration, where the router — not the server — is writing the URL.
    await page.locator('header').getByLabel('Buscar productos').click()
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
  test('lists exactly the markets the store sells in', async ({ page, goto }) => {
    await goto(`/${DEFAULT_MARKET}`)

    // The seeded markets, sorted by display name the way the country endpoint returns them.
    // Exhaustive on purpose: a control offering a market the store does not sell in quotes a
    // currency nobody configured, and it is this list that would have to grow for that to happen.
    // The count is what makes it exhaustive, and the accessible name is what a row says — the
    // flag beside it is decorative and hidden from the shopper who is being read to.
    await openMarketMenu(page)
    const markets = page.getByRole('menuitem')
    await expect(markets).toHaveCount(2)
    await expect(markets.nth(0)).toHaveAccessibleName('Colombia')
    await expect(markets.nth(1)).toHaveAccessibleName('United States')
  })

  test('switches market as a document navigation, keeping the path and its search', async ({
    page,
    authenticate,
    navigate,
    factories,
    goto,
  }) => {
    const term = faker.string.alpha({ length: 10, casing: 'lower' })
    // Priced in both currencies: the list is the catalogue a market can quote, so a product
    // carrying only dollars would be on the page before the switch and gone after it — a market
    // difference this test would then read as the search having been lost.
    await using product = await factories.create.productWithPricing({
      product: { title: `${term} tee` },
      prices: [
        { amount: '25.00', currencyCode: 'usd' },
        { amount: '100000', currencyCode: 'cop' },
      ],
    })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/', search: { q: term } })
    await expect(page).toHaveURL(`/${DEFAULT_MARKET}?q=${term}`)

    await switchMarket(page, SECOND_MARKET_NAME)

    // The same page, in the other market: the search survives the switch, so a shopper does not
    // lose what they were looking at to change where they are buying from.
    await expect(page).toHaveURL(`/${SECOND_MARKET}?q=${term}`)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)
    await expect(page.locator('main').getByRole('heading', { level: 3, name: product.title })).toBeVisible()

    // And the choice is persisted, which is what the cookie the switch writes is for: a later
    // visit to the root lands in the market that was chosen rather than the default.
    await goto('/')
    await expect(page).toHaveURL(`/${SECOND_MARKET}`)
  })

  test('quotes each market its own currency, punctuated the way that market writes it', async ({
    page,
    authenticate,
    navigate,
    factories,
    goto,
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

    await switchMarket(page, SECOND_MARKET_NAME)
    await expect(page).toHaveURL(`/${SECOND_MARKET}?q=${term}`)

    // Colombian grouping — a dot where the American form puts a comma — around the peso amount,
    // and no `COP` anywhere: `en-US` renders this same price as `COP 100,000`, which is the bare
    // currency code a shopper should never be shown.
    await expect(card).toContainText('100.000')
    await expect(card).not.toContainText('COP')
    await expect(card).not.toContainText('25')

    // The detail page prices the same way, off its own request rather than the list's — the two
    // are separate queries and only one of them has been proven to carry the market so far.
    await goto(`/${SECOND_MARKET}/products/${product.id}`)
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

    await switchMarket(page, SECOND_MARKET_NAME)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    // The bag still carries what was put in it — the claim this test owns. What the bag is
    // *priced* in after the crossing is the subject of `Cart across markets` below.
    //
    // The badge first, and not only because it is the claim: it is the cart request resolving,
    // which means the page has hydrated and the button below is a button rather than markup.
    const bag = page.locator('header').getByLabel('Carrito')
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

    await switchMarket(page, SECOND_MARKET_NAME)
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

    await switchMarket(page, SECOND_MARKET_NAME)
    await expect(page.locator('html')).toHaveAttribute('lang', SECOND_MARKET)

    const bag = page.locator('header').getByLabel('Carrito')
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
    goto,
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
    await goto(`/${SECOND_MARKET}`)

    const bag = page.locator('header').getByLabel('Carrito')
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

    await switchMarket(page, SECOND_MARKET_NAME)

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
    await page.locator('header').getByLabel('Carrito').click()
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

    await switchMarket(page, SECOND_MARKET_NAME)
    await expect(page.getByRole('alert')).toContainText(blocked.title, { timeout: BACKEND_TIMEOUT })

    // The refusal is not a dead end. Taking out the thing this market cannot sell is the shopper's
    // own way through it, and the storefront has to notice: the bag it asked about has changed, so
    // the same switch is worth asking for again without them touching the control a second time.
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await page.locator('header').getByLabel('Carrito').click()
    await cartPanel.getByRole('button', { name: `Eliminar ${blocked.title}` }).click()

    await expect(page.getByRole('alert')).toBeHidden({ timeout: BACKEND_TIMEOUT })
    await expect(cartPanel).toContainText('160.000', { timeout: BACKEND_TIMEOUT })
    await expect(cartPanel).not.toContainText('40.00')
  })
})

/**
 * The second market read end to end in its own language.
 *
 * Every assertion names the Spanish text, never a test id: a string left out of the catalog renders
 * its English source, and only reading the words tells the two apart. The English specs cover the
 * same surfaces under `/en-US`, so together they prove both catalogs load. Each surface carries
 * its own copy — the store's catalog for the chrome and pages, the shared schemas' catalog for a
 * validation message, the backend's for an API Message.
 */
test.describe('Spanish market', () => {
  test.describe.configure({ timeout: 60_000 })

  test('a shopper reads the chrome, a product, the cart and checkout in Spanish', async ({
    page,
    goto,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({
      prices: [
        { amount: '25.00', currencyCode: 'usd' },
        { amount: '100000', currencyCode: 'cop' },
      ],
    })
    disposeCartAfterTest(page, factories, cleanup)
    // Every page below is server-rendered in Spanish first; a string the client renders differently
    // is a hydration mismatch, not only a wrong word.
    const hydrationErrors: Array<string> = []
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydrat/i.test(message.text())) hydrationErrors.push(message.text())
    })

    // Chrome: the header and footer every page carries.
    await goto(`/${SECOND_MARKET}`)
    await expect(page.locator('header').getByLabel('Carrito', { exact: true })).toBeVisible()
    await expect(page.locator('footer').getByRole('button', { name: `Mercado: ${SECOND_MARKET_NAME}` })).toBeVisible()

    // Products: the page's own action, not the merchant's title, which is out of scope.
    await goto(`/${SECOND_MARKET}/products/${product.id}`)
    const addToCart = page.getByRole('button', { name: 'Agregar al carrito' })
    await expect(addToCart).toBeVisible()
    await addToCart.click()

    // Cart: the panel adding opens.
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel.getByText(product.title)).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(cartPanel.getByLabel('Cerrar carrito')).toBeVisible()
    await cartPanel.getByRole('link', { name: 'Finalizar compra' }).click()

    // Checkout: a guest sees every section at once.
    await expect(page).toHaveURL(`/${SECOND_MARKET}/checkout`)
    await expect(page.getByRole('heading', { name: 'Contacto' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entrega' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contact', exact: true })).toHaveCount(0)
    expect(hydrationErrors).toEqual([])
  })

  test('a customer reads their account and orders in Spanish', async ({ page, authenticate, goto }) => {
    await authenticate({ as: 'customer' })

    await goto(`/${SECOND_MARKET}/account`)
    await expect(page.getByRole('heading', { name: /^Hola/ })).toBeVisible()
    await expect(page.getByText('Aún no has hecho pedidos. Cuando hagas uno, aparecerá aquí.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ver todos los productos' })).toBeVisible()
  })

  test('sign-in speaks Spanish, down to its validation and the API’s answer', async ({ page, goto, factories }) => {
    const credentials = factories.generate.loginForm()

    await goto(`/${SECOND_MARKET}/login`)
    const signIn = page.getByRole('button', { name: 'Inicia sesión' })

    // A validation message: the shared schema's catalog, rendered by the store.
    await signIn.click()
    await expect(page.getByText('Ingresa un correo electrónico válido')).toBeVisible()
    await expect(page.getByText('Ingresa tu contraseña')).toBeVisible()
    await expect(page).toHaveURL(`/${SECOND_MARKET}/login`)

    // An API Message: the backend translates it before it leaves, from the request's locale.
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(credentials.email)
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(credentials.password)
    await signIn.click()
    await expect(page.getByText('Correo o contraseña incorrectos').first()).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(page.getByText(/invalid email or password/i)).toHaveCount(0)
  })
})
