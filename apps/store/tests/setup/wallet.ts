import type { Page } from '@playwright/test'
import { type GatewayCustomer, gatewayCustomerFor } from '../mocks/fake-gateway.js'
import { expect } from './test-extend.js'

/**
 * Steps the two wallet specs share — the checkout selector's and the account page's.
 *
 * They are shared rather than copied because both files need the same awkward prelude: nothing
 * exists at the gateway for a shopper until they reach a surface that needs an account holder, so
 * a wallet cannot be seeded until one has been visited. That ordering *is* the lazy-creation rule,
 * so encoding it once keeps both specs honest about it.
 */

/** Signs a customer in through the form, which is the only thing that issues a store token. */
export async function signIn(page: Page, customer: { email: string; password: string }) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(customer.email)
  await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page).toHaveURL('/account', { timeout: 15_000 })
}

/**
 * Opens `/account/payment-methods` and hands back the gateway customer it caused to exist.
 *
 * Waiting for the empty state rather than the heading is the point: the heading paints before the
 * wallet request resolves, and the account holder is created by that request. Reading the gateway
 * any earlier is a race that fails one run in ten.
 */
export async function openAccountWallet(page: Page, proteusCustomerId: string): Promise<GatewayCustomer> {
  await page.goto('/account/payment-methods')
  await expect(page.getByRole('heading', { name: 'No saved cards' })).toBeVisible({ timeout: 15_000 })
  return gatewayCustomerFor(proteusCustomerId)
}

/** A month the card is still good in, well clear of any boundary. */
export function futureExpiry(): { expMonth: number; expYear: number } {
  const now = new Date()
  return { expMonth: now.getMonth() + 1, expYear: now.getFullYear() + 3 }
}

/** The month that has just passed — expired, whichever month of the year it is run in. */
export function lastMonthExpiry(): { expMonth: number; expYear: number } {
  const now = new Date()
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return { expMonth: previous.getMonth() + 1, expYear: previous.getFullYear() }
}

/** This month — labelled, and still selectable: the card works until the last day of it. */
export function thisMonthExpiry(): { expMonth: number; expYear: number } {
  const now = new Date()
  return { expMonth: now.getMonth() + 1, expYear: now.getFullYear() }
}

/**
 * Removes a card without the page knowing, through the shopper's own session.
 *
 * The case this stands for is real and is not a broken client: a shopper who removed the card in
 * another tab, or whose session moved on while the selector sat open. The page must find out at
 * the press, from the `409`, rather than from anything it was told beforehand.
 */
export async function detachCardOutOfBand(page: Page, methodId: string) {
  const token = await page.evaluate(() => localStorage.getItem('proteus_store_token'))
  expect(token, 'the page holds no session token').toBeTruthy()

  const backendUrl = process.env.VITE_BACKEND_URL
  expect(backendUrl, 'VITE_BACKEND_URL is unset — run the suite through `npm run test:e2e`').toBeTruthy()

  const response = await page.request.delete(`${backendUrl}/store/payment-methods/${methodId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(response.ok(), `the wallet refused to detach the card: ${response.status()}`).toBe(true)
}

/**
 * Makes the browser refetch the wallet, the way a shopper coming back to the tab would.
 *
 * React Query refetches a stale query on focus, so this is the trigger a real shopper produces
 * rather than one invented for the test — which is what makes "auto-selection happens once"
 * assertable at all.
 */
export async function refocusTab(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')))
}

/** The ids of the saved-card rows on screen, in the order they are rendered. */
export async function renderedCardIds(page: Page): Promise<string[]> {
  return (await walletSnapshot(page)).map((row) => row.id)
}

/**
 * One point-in-time read of the rows and the selection.
 *
 * Point-in-time is the whole value of it. `expect(locator).toHaveCount(0)` retries until it is
 * true, so it passes the moment a refetch corrects a wrong render — and a wrong render corrected
 * a moment later is exactly the bug: the shopper is shown a card they removed, and the selector
 * latches onto it, before the correction arrives. Pair it with `delayWalletReads` so the sample
 * lands inside that window.
 */
export async function walletSnapshot(page: Page): Promise<{ id: string; checked: boolean }[]> {
  return page.getByTestId('saved-card-row').evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.getAttribute('data-method-id') ?? '',
      checked: row.querySelector('[role="radio"]')?.getAttribute('aria-checked') === 'true',
    })),
  )
}

/**
 * Walks to the account wallet the way a shopper does — through the header, with no page load.
 *
 * A `goto` would discard the query cache and hide the very thing these specs are about: whether
 * the two surfaces agree about a card that was just removed. The disagreement lives *in* the
 * cache, so the navigation has to be one that keeps it.
 */
export async function walkToAccountWallet(page: Page) {
  await page.getByRole('link', { name: 'Back to cart' }).click()
  await expect(page).toHaveURL(/\/\?modal=cart/)

  // The cart opens over the page and covers the header, so it has to go before the account link
  // is reachable.
  await page.getByRole('button', { name: 'Close cart' }).click()
  await page.getByRole('banner').getByRole('link', { name: 'Account' }).click()
  await expect(page).toHaveURL('/account')

  await page.getByRole('link', { name: 'Payment Methods' }).click()
  await expect(page).toHaveURL('/account/payment-methods')
}

/**
 * Back to the payment step without a page load, the way a shopper who changed their mind gets
 * there — and the shape that resurrected a removed card from cache and auto-selected it.
 */
export async function walkBackToPaymentStep(page: Page) {
  await page.getByRole('link', { name: 'Back to cart' }).click()
  await expect(page).toHaveURL(/\/\?modal=cart/)

  const cartPanel = page.locator('[data-slot="drawer-popup"]')
  await expect(cartPanel).toBeVisible()
  await cartPanel.getByRole('link', { name: /checkout/i }).click()
  await expect(page).toHaveURL(/\/checkout/)
}

/**
 * Holds the wallet read open, so what a surface renders *from cache* is observable.
 *
 * Without it the refetch lands in tens of milliseconds and a stale first paint is invisible to an
 * assertion — which is exactly how the resurrected-card bug reached review.
 */
export async function delayWalletReads(page: Page, ms = 1_500) {
  await page.route('**/store/payment-methods', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, ms))
    await route.continue()
  })
}
