import type { Page } from '@playwright/test'
import { expect } from './test-extend.js'

/** Fills the checkout's shipping-address step. The values are arbitrary but must be a real US state. */
export async function fillShippingAddress(page: Page) {
  await page.getByLabel('First name').fill('John')
  await page.getByLabel('Last name').fill('Doe')
  // Exact: 'Billing address same as shipping' is a real label now that the checkbox carries an
  // htmlFor, and a loose match would hit it too.
  await page.getByLabel('Address', { exact: true }).fill('123 Main St')
  await page.getByLabel('City').fill('Austin')
  await page.getByLabel('Country').selectOption('us')
  await page.getByLabel('State / Province').fill('TX')
  await page.getByLabel('Postal code').fill('78701')
  await page.getByLabel('Phone').fill('5551234567')
}

/**
 * Drives an authenticated shopper from the address step to the confirmation page and returns the
 * order's display number. Orders have no factory — the checkout workflow is the only thing that
 * writes one — so any spec that needs an existing order has to place it through the UI.
 */
export async function placeOrder(page: Page, shippingOptionName: string): Promise<string> {
  await expect(page).toHaveURL(/step=address/, { timeout: 10_000 })
  await fillShippingAddress(page)
  await page.getByRole('button', { name: /continue to delivery/i }).click()

  await expect(page).toHaveURL(/step=delivery/, { timeout: 10_000 })
  // By name, not `.first()`: tests run in parallel and each creates its own US shipping option,
  // so the delivery step lists a neighbour's too — and picking it means selecting a row that
  // disappears when that test disposes its fixtures.
  const shippingOption = page.getByRole('radio', { name: shippingOptionName })
  await expect(shippingOption).toBeVisible({ timeout: 10_000 })
  await shippingOption.click()
  await page.getByRole('button', { name: /continue to payment/i }).click()

  await expect(page).toHaveURL(/step=payment/, { timeout: 10_000 })
  const paymentOption = page.getByRole('radio', { name: /manual payment/i })
  await expect(paymentOption).toBeVisible({ timeout: 10_000 })
  await paymentOption.click()
  await page.getByRole('button', { name: /continue to review/i }).click()

  await expect(page).toHaveURL(/step=review/, { timeout: 10_000 })
  await page.getByRole('button', { name: /place order/i }).click()

  await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15_000 })
  const orderNumber = await page.getByText(/order number:/i).innerText()
  const displayId = orderNumber.replace(/\D/g, '')
  expect(displayId, `Could not read a display id out of "${orderNumber}"`).not.toBe('')
  return displayId
}

/**
 * Fills the address-book drawer. `label` and `city` are what the specs assert on; the rest is
 * arbitrary but must be a real US state, the same constraint `fillShippingAddress` carries.
 */
export async function fillAddressForm(page: Page, { label, city }: { label: string; city: string }) {
  await page.getByLabel('Label (e.g. Home)').fill(label)
  await page.getByLabel('First name').fill('John')
  await page.getByLabel('Last name').fill('Doe')
  await page.getByLabel('Address', { exact: true }).fill('123 Main St')
  await page.getByLabel('City').fill(city)
  await page.getByLabel('Country').selectOption('us')
  await page.getByLabel('State / Province').fill('TX')
  await page.getByLabel('Postal code').fill('78701')
  // By role, not by label: Base UI renders a span[role=checkbox] plus a hidden native input, and
  // the label's htmlFor associates both, so getByLabel matches two elements. Only the span is in
  // the accessibility tree — the input carries aria-hidden — so the role selector is both
  // unambiguous and the layer this should be asserting against.
  await page.getByRole('checkbox', { name: 'Make this my main address' }).check()
}
