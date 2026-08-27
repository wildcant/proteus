import { BACKEND_TIMEOUT } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'
import { placeOrder, SHIPPING_ADDRESS } from '../setup/utils.js'

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
    // With an option, so the detail row has an options line to render — the one thing on this
    // page that needed a backend change to exist at all.
    await using product = await factories.create.productWithOption({ price: { amount: '25.00' } })
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

    // `variantOptionValues` was dropped by the store response schema until this page needed it,
    // so the line rendering is the assertion that the key survives the wire.
    await expect(page.getByText(product.optionValue.value)).toBeVisible()

    // The address the checkout submitted, back on the record of it — including the country as a
    // name rather than the `US` the page used to print. Asserted against the page rather than a
    // scoped panel: this is the only address on it.
    await expect(page.getByText(SHIPPING_ADDRESS.address1)).toBeVisible()
    await expect(page.getByText(`${SHIPPING_ADDRESS.city}, ${SHIPPING_ADDRESS.province}`)).toBeVisible()
    await expect(page.getByText(SHIPPING_ADDRESS.countryName)).toBeVisible()
  })
})
