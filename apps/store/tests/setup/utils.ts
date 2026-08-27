import type { Page } from '@playwright/test'
import type { CleanupFunction, Factories } from '@proteus/testing'
import { expect } from './test-extend.js'

/**
 * Disposes the cart the browser made, at the end of the test that made it.
 *
 * Carts have no factory — the storefront creates one on the first add to cart — so the only place
 * the id exists is the page's own storage, and it has to be read back out before the page closes.
 */
export function disposeCartAfterTest(page: Page, factories: Factories, cleanup: CleanupFunction) {
  cleanup.add(async () => {
    const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
    if (cartId) await factories.destroy.cart(cartId)
  })
}

/**
 * What `fillShippingAddress` types. Exported so a spec asserting the address came back on the
 * order can read the same values rather than retyping the strings beside them.
 *
 * `countryName` is the rendered country, not the code the form selects — an order prints
 * "United States", never "US".
 */
export const SHIPPING_ADDRESS = {
  countryCode: 'us',
  countryName: 'United States',
  firstName: 'John',
  lastName: 'Doe',
  address1: '123 Main St',
  city: 'Austin',
  province: 'TX',
  postalCode: '78701',
  phone: '5551234567',
} as const

/** Fills the checkout's delivery block. The values are arbitrary but must be a real US state. */
export async function fillShippingAddress(page: Page) {
  await page.getByLabel('Country').selectOption(SHIPPING_ADDRESS.countryCode)
  await page.getByLabel('First name').fill(SHIPPING_ADDRESS.firstName)
  await page.getByLabel('Last name').fill(SHIPPING_ADDRESS.lastName)
  // Exact: 'Apartment, suite, etc.' and 'Billing address same as shipping' are both real labels
  // containing the word, and a loose match would hit them too.
  await page.getByLabel('Address', { exact: true }).fill(SHIPPING_ADDRESS.address1)
  await page.getByLabel('City').fill(SHIPPING_ADDRESS.city)
  await page.getByLabel('State / Province').fill(SHIPPING_ADDRESS.province)
  await page.getByLabel('Postal code').fill(SHIPPING_ADDRESS.postalCode)
  await page.getByLabel('Phone').fill(SHIPPING_ADDRESS.phone)
  // There is no "Continue to delivery" button any more: the address is written to the cart when
  // focus leaves the block, and `fill()` does not blur on its own. This line is the whole
  // commit-on-blur decision expressed as a test — drop it and the rates never load.
  await page.getByLabel('Phone').blur()
}

/**
 * Drives an authenticated shopper from the address step to the confirmation page and returns the
 * order's display number. Orders have no factory — the checkout workflow is the only thing that
 * writes one — so any spec that needs an existing order has to place it through the UI.
 */
export async function placeOrder(page: Page, shippingOptionName: string): Promise<string> {
  await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible({ timeout: 10_000 })
  await fillShippingAddress(page)

  // By name, not `.first()`: tests run in parallel and each creates its own US shipping option,
  // so the list carries a neighbour's too — and picking it means selecting a row that
  // disappears when that test disposes its fixtures.
  //
  // Waiting for it to appear is also the assertion that the blur above reached the cart and that
  // the rates were quoted against the address, which the old `?step=delivery` never claimed.
  const shippingOption = page.getByRole('radio', { name: shippingOptionName })
  await expect(shippingOption).toBeVisible({ timeout: 10_000 })
  await shippingOption.click()

  // Selecting is the write now, so the order cannot be placed until it lands. The summary saying
  // something other than "Enter shipping address" is what says it did.
  await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10_000 })

  const paymentOption = page.getByRole('radio', { name: /manual payment/i })
  await expect(paymentOption).toBeVisible({ timeout: 10_000 })
  await paymentOption.click()

  await page.getByRole('button', { name: /place order/i }).click()

  await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15_000 })
  // Both order routes print the number the same way, so this read works on either of them.
  const orderNumber = await page.getByRole('heading', { name: /^Order #\d+$/ }).innerText()
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
