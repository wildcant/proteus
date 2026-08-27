import { expect, test } from '../setup/test-extend.js'

/** The panel is the only drawer this spec ever opens, so the shared slot is unambiguous here. */
const PANEL = '[data-slot="drawer-popup"]'

test.describe('Cart', () => {
  test('full cart journey: add, review in the panel, remove, checkout, and back', async ({
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

    // The panel is the confirmation now, in place of the toast
    const panel = page.locator(PANEL)
    await expect(panel).toBeVisible()
    await expect(panel.getByText(productA.title)).toBeVisible()

    // Assert nav cart badge shows item count. One bag at every width now, so no `.last()`:
    // this should fail the day a second `aria-label="Cart"` reappears.
    const cartBadge = page.locator('header [aria-label="Cart"] span').filter({ hasText: '1' })
    await expect(cartBadge).toBeVisible()

    // 2. The panel *is* the cart — there is no page to navigate to. Unit price and the summary
    // are both on it, so reviewing the bag never leaves the product.
    // Scoped to the row: at quantity one the unit price and the cart total are the same number,
    // so an unscoped `$25.00` matches both.
    const rowA = panel.getByRole('listitem').filter({ hasText: productA.title })
    await expect(rowA.getByText('$25.00')).toBeVisible()
    await expect(panel.getByRole('heading', { name: 'Order summary' })).toBeVisible()
    await expect(panel.getByText('Total', { exact: true })).toBeVisible()

    // 3. Add a second product. The panel reopens carrying both.
    await navigate({ to: '/products/$productId', params: { productId: productB.id } })
    await expect(page.getByRole('heading', { name: productB.title })).toBeVisible()
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(panel.getByText(productB.title)).toBeVisible()
    await expect(panel.getByText(productA.title)).toBeVisible()

    // 4. Remove the second item from the panel; the first survives
    await panel.getByRole('button', { name: `Remove ${productB.title}` }).click()
    await expect(panel.getByText(productB.title)).not.toBeVisible()
    await expect(panel.getByText(productA.title)).toBeVisible()

    // 5. Checkout from the panel
    await panel.getByRole('link', { name: /checkout/i }).click()
    await expect(page).toHaveURL(/\/checkout/)

    // Checkout layout has "Back to cart", no shop chrome, no footer. The bag is what stands in
    // for "no nav" — the hamburger is mobile-only, so asserting on it here would pass whatever
    // the checkout layout rendered.
    await expect(page.getByRole('link', { name: /back to cart/i })).toBeVisible()
    await expect(page.getByLabel('Cart')).toHaveCount(0)
    await expect(page.locator('footer')).not.toBeVisible()

    // 6. "Back to cart" lands on the catalogue with the panel open, which is where the cart
    // lives now. Full layout returns with it.
    await page.getByRole('link', { name: /back to cart/i }).click()
    await expect(page).toHaveURL('/?modal=cart')
    await expect(panel).toBeVisible()
    await expect(panel.getByText(productA.title)).toBeVisible()
    // Exact: the panel is open, so a substring `Cart` also matches its `Close cart` button.
    await expect(page.getByLabel('Cart', { exact: true })).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
  })

  test('the panel is URL state: adding opens it, back and the ✕ both close it', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    // Opening is caused by the mutation, and it lands in the address bar
    const panel = page.locator(PANEL)
    await expect(panel).toBeVisible()
    await expect(panel.getByText(product.title)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/products/${product.id}\\?modal=cart$`))

    // Opening pushed, so hardware back closes it
    await page.goBack()
    await expect(panel).not.toBeVisible()
    await expect(page).toHaveURL(`/products/${product.id}`)

    // Closing with the ✕ replaces rather than pushes, so there is no entry to go forward into
    await page.getByLabel('Cart', { exact: true }).click()
    await expect(panel).toBeVisible()
    await panel.getByLabel('Close cart').click()
    await expect(panel).not.toBeVisible()
    await expect(page).toHaveURL(`/products/${product.id}`)

    await page.goForward()
    await expect(panel).not.toBeVisible()
  })

  test('the panel stepper raises the quantity and removes the row at one', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const panel = page.locator(PANEL)
    // The count is an <output>, which is what puts it in the status role.
    const quantity = panel.getByRole('status')
    await expect(quantity).toHaveText('1')

    // The total follows the stepper. $50.00 is unambiguous where $25.00 is not — at quantity one
    // the unit price and the total are the same number.
    await panel.getByLabel(`Increase quantity for ${product.title}`).click()
    await expect(quantity).toHaveText('2')
    await expect(panel.getByText('$50.00')).toBeVisible()

    await panel.getByLabel(`Decrease quantity for ${product.title}`).click()
    await expect(quantity).toHaveText('1')

    // At one the decrement *is* the remove, and says so
    await expect(panel.getByLabel(`Decrease quantity for ${product.title}`)).toHaveCount(0)
    await panel.getByLabel(`Remove ${product.title}`).click()
    await expect(panel.getByText('Your bag is empty')).toBeVisible()
  })

  test('the row names the chosen variant, and a cold open never shows the empty state', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithOption()

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    // The options line only renders once `AddLineItem` carries `variantOptionValues`, so this is
    // also the assertion that proves the payload change took.
    const panel = page.locator(PANEL)
    await expect(panel.getByText(product.optionValue.value)).toBeVisible()

    // A cold open: `?modal=cart` reached by a full page load, with the cart already populated but
    // the query cache empty. `useCart` does not suspend, so without the skeleton branch the panel
    // would render "Your bag is empty" for the width of a request.
    await navigate({ to: '/', search: { modal: 'cart' } })
    await expect(panel).toBeVisible()
    await expect(panel.getByText('Your bag is empty')).toBeHidden()
    await expect(panel.getByText(product.title)).toBeVisible()
  })
})
