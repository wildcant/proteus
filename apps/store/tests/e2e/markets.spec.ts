import { expect, test } from '../setup/test-extend.js'

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
