import { BACKEND_TIMEOUT } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'
import { placeOrder } from '../setup/utils.js'

test.describe('Orders', () => {
  // Orders have no factory — the checkout workflow is the only thing that writes one, so this
  // drives the whole flow through the UI, which is slow.
  test.describe.configure({ timeout: 60_000 })

  test('a customer with an order sees it in the panel and can open its detail', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    await authenticate({ as: 'customer' })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    // Adding opens the cart panel — that is the confirmation now, in place of a toast, and it
    // is also the way to checkout, so this order is placed without ever leaving the product.
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await expect(cartPanel.getByText(product.title)).toBeVisible()

    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    const displayId = await placeOrder(page, shipping.name)

    await navigate({ to: '/account' })

    const orderRow = page.getByRole('link', { name: new RegExp(`#${displayId}\\b`) })
    await expect(orderRow).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await orderRow.click()

    // The detail is its own route, not the confirmation page: no "Thank you!" six months on.
    await expect(page).toHaveURL(/\/account\/orders\/ord_/)
    await expect(page.getByRole('heading', { name: `#${displayId}` })).toBeVisible()
    await expect(page.getByRole('heading', { name: /thank you/i })).not.toBeVisible()
    await expect(page.getByText(product.title).first()).toBeVisible()
  })
})
