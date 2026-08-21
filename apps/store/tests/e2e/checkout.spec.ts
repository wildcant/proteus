import type { Page } from '@playwright/test'
import { createCheckoutInfrastructure } from 'backend/test'
import { expect, test } from '../setup/test-extend.js'

async function fillShippingAddress(page: Page) {
  await page.getByLabel('First name').fill('John')
  await page.getByLabel('Last name').fill('Doe')
  await page.getByLabel('Address').fill('123 Main St')
  await page.getByLabel('City').fill('Austin')
  await page.getByLabel('Country').selectOption('us')
  await page.getByLabel('State / Province').fill('TX')
  await page.getByLabel('Postal code').fill('78701')
  await page.getByLabel('Phone').fill('5551234567')
}

let disposeInfra: () => Promise<void>

test.describe('Checkout', () => {
  test.beforeAll(async () => {
    const infra = await createCheckoutInfrastructure()
    disposeInfra = infra[Symbol.asyncDispose]
  })
  test.afterAll(async () => {
    await disposeInfra()
  })
  test.describe.configure({ mode: 'serial', timeout: 60_000 })

  test('guest checkout: full flow from product to order confirmation', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({
      price: { amount: '25.00' },
    })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    // 1. Add product to cart as guest
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')

    // 2. Go to cart, verify product appears
    await navigate({ to: '/cart' })
    await expect(page.getByText(product.title)).toBeVisible()

    // 3. Click "Go to checkout" — guest lands on contact step
    await page.getByRole('link', { name: /go to checkout/i }).click()
    await expect(page).toHaveURL(/step=contact/)

    // 4. Contact step: fill email and submit
    const guestEmail = 'guest-checkout@example.com'
    await page.getByLabel('Email').fill(guestEmail)
    await page.getByRole('button', { name: /continue to shipping/i }).click()

    // 5. Shipping address step: fill address and submit
    await expect(page).toHaveURL(/step=address/, { timeout: 10000 })
    await fillShippingAddress(page)
    await page.getByRole('button', { name: /continue to delivery/i }).click()

    // 6. Delivery step: wait for shipping options to load, select first
    await expect(page).toHaveURL(/step=delivery/, { timeout: 10000 })
    const shippingRadio = page.getByRole('radio').first()
    await expect(shippingRadio).toBeVisible({ timeout: 10000 })
    await shippingRadio.click()
    await page.getByRole('button', { name: /continue to payment/i }).click()

    // 7. Payment step: select Manual Payment provider
    await expect(page).toHaveURL(/step=payment/, { timeout: 10000 })
    const paymentRadio = page.getByRole('radio', { name: /manual payment/i })
    await expect(paymentRadio).toBeVisible({ timeout: 10000 })
    await paymentRadio.click()
    await page.getByRole('button', { name: /continue to review/i }).click()

    // 8. Review step: place order
    await expect(page).toHaveURL(/step=review/, { timeout: 10000 })
    await page.getByRole('button', { name: /place order/i }).click()

    // 9. Order confirmation page
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Your order was placed successfully.')).toBeVisible()
    await expect(page.getByText(guestEmail).first()).toBeVisible()
  })

  test('guest to authenticated: cart transfer and checkout', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({
      price: { amount: '35.00' },
    })
    await using customer = await factories.create.customer({ hasAccount: true })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    // 1. Add product to cart as guest
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')

    // 2. Log in — cart transfer happens automatically on login success
    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/account', { timeout: 15000 })

    // 3. Verify cart was transferred — product is still in cart
    await navigate({ to: '/cart' })
    await expect(page.getByText(product.title)).toBeVisible()

    // 4. Go to checkout — authenticated user skips contact, lands on address step
    await page.getByRole('link', { name: /go to checkout/i }).click()
    await expect(page).toHaveURL(/step=address/)

    // Contact step heading should not be visible (skipped for authenticated users)
    await expect(page.getByRole('heading', { name: 'Contact' })).not.toBeVisible()

    // 5. Shipping address step: fill address and submit
    await fillShippingAddress(page)
    await page.getByRole('button', { name: /continue to delivery/i }).click()

    // 6. Delivery step: select first shipping option
    await expect(page).toHaveURL(/step=delivery/, { timeout: 10000 })
    const shippingRadio = page.getByRole('radio').first()
    await expect(shippingRadio).toBeVisible({ timeout: 10000 })
    await shippingRadio.click()
    await page.getByRole('button', { name: /continue to payment/i }).click()

    // 7. Payment step: select Manual Payment provider
    await expect(page).toHaveURL(/step=payment/, { timeout: 10000 })
    const paymentRadio = page.getByRole('radio', { name: /manual payment/i })
    await expect(paymentRadio).toBeVisible({ timeout: 10000 })
    await paymentRadio.click()
    await page.getByRole('button', { name: /continue to review/i }).click()

    // 8. Review step: place order
    await expect(page).toHaveURL(/step=review/, { timeout: 10000 })
    await page.getByRole('button', { name: /place order/i }).click()

    // 9. Order confirmation — email should be the customer's registered email
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Your order was placed successfully.')).toBeVisible()
    await expect(page.getByText(customer.email).first()).toBeVisible()
  })
})
