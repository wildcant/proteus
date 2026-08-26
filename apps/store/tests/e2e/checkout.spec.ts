import { expect, test } from '../setup/test-extend.js'
import { fillShippingAddress } from '../setup/utils.js'

test.describe('Checkout', () => {
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
    await using shipping = await factories.create.shippingOptionWithZone()

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    // 1. Add product to cart as guest
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    // Adding opens the cart panel — that is the confirmation now, in place of a toast, and it
    // is the stronger assertion: it proves the item reached the cart, not just that a mutation
    // resolved. Dismissed explicitly so the close control is exercised somewhere in this spec.
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await expect(cartPanel.getByText(product.title)).toBeVisible()
    await cartPanel.getByLabel('Close cart').click()

    // 2. Reopen from the bag. The panel is the only cart surface now, so this is also the
    // assertion that it survives being closed and reopened rather than only rendering on the
    // mutation that populated it.
    await page.getByLabel('Cart', { exact: true }).click()
    await expect(cartPanel.getByText(product.title)).toBeVisible()

    // 3. Check out from the panel — guest lands on contact step
    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    await expect(page).toHaveURL(/step=contact/)

    // 4. Contact step: fill email and submit
    const guestEmail = 'guest-checkout@example.com'
    await page.getByLabel('Email').fill(guestEmail)
    await page.getByRole('button', { name: /continue to shipping/i }).click()

    // 5. Shipping address step: fill address and submit
    await expect(page).toHaveURL(/step=address/, { timeout: 10000 })
    await fillShippingAddress(page)
    await page.getByRole('button', { name: /continue to delivery/i }).click()

    // 6. Delivery step: select the option this test created — other tests' options are listed too
    await expect(page).toHaveURL(/step=delivery/, { timeout: 10000 })
    const shippingRadio = page.getByRole('radio', { name: shipping.name })
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
    await using shipping = await factories.create.shippingOptionWithZone()
    await using customer = await factories.create.customer({ hasAccount: true })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    // 1. Add product to cart as guest
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await expect(cartPanel.getByText(product.title)).toBeVisible()

    // 2. Log in — the `navigate` below is a full page load, so it dismisses the panel for us — cart transfer happens automatically on login success
    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/account', { timeout: 15000 })

    // 3. Verify cart was transferred — the bag on /account still carries the guest's item
    await page.getByLabel('Cart', { exact: true }).click()
    await expect(cartPanel.getByText(product.title)).toBeVisible()

    // 4. Check out — authenticated user skips contact, lands on address step
    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    await expect(page).toHaveURL(/step=address/)

    // Contact step heading should not be visible (skipped for authenticated users)
    await expect(page.getByRole('heading', { name: 'Contact' })).not.toBeVisible()

    // 5. Shipping address step: fill address and submit
    await fillShippingAddress(page)
    await page.getByRole('button', { name: /continue to delivery/i }).click()

    // 6. Delivery step: select the option this test created — other tests' options are listed too
    await expect(page).toHaveURL(/step=delivery/, { timeout: 10000 })
    const shippingRadio = page.getByRole('radio', { name: shipping.name })
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
