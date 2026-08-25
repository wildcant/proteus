import { BACKEND_TIMEOUT } from '@proteus/testing'
import { createCheckoutInfrastructure } from 'backend/test'
import { expect, test } from '../setup/test-extend.js'
import { placeOrder } from '../setup/utils.js'

let disposeInfra: () => Promise<void>

test.describe('Orders', () => {
  // Orders have no factory — the checkout workflow is the only thing that writes one, so this
  // spec needs the shipping options and payment providers that flow depends on.
  test.beforeAll(async () => {
    const infra = await createCheckoutInfrastructure()
    disposeInfra = infra[Symbol.asyncDispose]
  })
  test.afterAll(async () => {
    await disposeInfra()
  })
  test.describe.configure({ mode: 'serial', timeout: 60_000 })

  test('a customer with an order sees it in the panel and can open its detail', async ({
    page,
    authenticate,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })

    await authenticate({ as: 'customer' })

    cleanup.add(async () => {
      const cartId = await page.evaluate(() => localStorage.getItem('proteus_store_cart_id'))
      if (cartId) await factories.destroy.cart(cartId)
    })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    await expect(page.locator('[data-slot="toast-title"]')).toHaveText('Added to cart')

    await navigate({ to: '/cart' })
    await page.getByRole('link', { name: /go to checkout/i }).click()
    const displayId = await placeOrder(page)

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
