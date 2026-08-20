import { expect, test } from '../setup/test-extend.js'

test.describe('Cart', () => {
  test('full cart journey: add, view, update, remove, checkout layout', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    // Seed two products with pricing
    await using productA = await factories.create.productWithPricing({
      price: { amount: '25.00' },
    })
    await using productB = await factories.create.productWithPricing({
      price: { amount: '49.99' },
    })

    await authenticate({ as: 'customer' })

    // Clean up cart created via UI after the test
    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    // 1. Navigate to first product, add to cart
    await navigate({ to: '/products/$productId', params: { productId: productA.id } })
    await expect(page.getByRole('heading', { name: productA.title })).toBeVisible()

    const addToCartButton = page.getByRole('button', { name: /add to cart/i })
    await expect(addToCartButton).toBeVisible()
    await addToCartButton.click()

    // Assert toast appears
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')

    // Assert nav cart badge shows item count (desktop badge is the visible one)
    const cartBadge = page.locator('header nav [aria-label="Cart"] span').filter({ hasText: '1' })
    await expect(cartBadge.last()).toBeVisible()

    // 2. Navigate to /cart, assert item appears
    await navigate({ to: '/cart' })
    await expect(page.getByText(productA.title)).toBeVisible()
    await expect(page.getByText('$25.00 each')).toBeVisible()

    // Assert totals are displayed
    const orderSummary = page.locator('aside')
    await expect(orderSummary.getByText('Items total')).toBeVisible()
    await expect(orderSummary.getByText('Total', { exact: true })).toBeVisible()

    // 3. Change quantity
    const quantitySelect = page.getByLabel(`Quantity for ${productA.title}`)
    await quantitySelect.selectOption('3')

    // Wait for line total to update — 3 × $25.00 = $75.00
    const lineTotal = page.locator('section').getByText('$75.00')
    await expect(lineTotal).toBeVisible({ timeout: 5000 })

    // 4. Navigate to second product, add to cart
    await navigate({ to: '/products/$productId', params: { productId: productB.id } })
    await expect(page.getByRole('heading', { name: productB.title })).toBeVisible()
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')

    // 5. Return to /cart, assert both items appear
    await navigate({ to: '/cart' })
    await expect(page.getByText(productA.title)).toBeVisible()
    await expect(page.getByText(productB.title)).toBeVisible()

    // 6. Remove second item
    await page.getByRole('button', { name: `Remove ${productB.title}` }).click()

    // Assert it disappears, first item remains
    await expect(page.getByText(productB.title)).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText(productA.title)).toBeVisible()

    // 7. Click "Go to checkout", assert checkout layout
    await page.getByRole('link', { name: /go to checkout/i }).click()
    await expect(page).toHaveURL('/checkout')

    // Checkout layout has "Back to cart" link, no hamburger, no footer
    await expect(page.getByRole('link', { name: /back to cart/i })).toBeVisible()
    await expect(page.getByLabel('Open menu')).not.toBeVisible()
    await expect(page.locator('footer')).not.toBeVisible()

    // 8. Click "Back to cart", assert full layout returns
    await page.getByRole('link', { name: /back to cart/i }).click()
    await expect(page).toHaveURL('/cart')
    await expect(page.getByLabel('Open menu')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('layout: nav, side menu, and footer', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    // Nav is visible with hamburger, logo, and cart icon
    const nav = page.locator('header').locator('nav')
    await expect(nav.getByLabel('Open menu')).toBeVisible()
    await expect(nav.getByText('Proteus')).toBeVisible()
    await expect(nav.getByLabel('Cart').last()).toBeVisible()

    // Open side menu
    await nav.getByLabel('Open menu').click()
    const sideMenu = page.locator('[data-slot="sheet-content"]')
    await expect(sideMenu).toBeVisible()

    // Side menu contains expected links
    await expect(sideMenu.getByText('Home')).toBeVisible()
    await expect(sideMenu.getByText('Products')).toBeVisible()
    await expect(sideMenu.getByText('Account')).toBeVisible()
    await expect(sideMenu.getByText('Cart')).toBeVisible()

    // Close side menu
    await page.keyboard.press('Escape')
    await expect(sideMenu).not.toBeVisible()

    // Footer shows link sections and copyright
    const footer = page.locator('footer')
    await expect(footer.getByText('Shop')).toBeVisible()
    await expect(footer.getByText('Help')).toBeVisible()
    await expect(footer.getByText('Company')).toBeVisible()
    await expect(footer.getByText(/Proteus\. All rights reserved/)).toBeVisible()
  })
})
