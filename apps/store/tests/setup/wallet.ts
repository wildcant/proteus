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
  const ids = await page
    .getByTestId('saved-card-row')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-method-id') ?? ''))
  return ids
}
