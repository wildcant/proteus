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
    await expect(page.getByRole('heading', { name: `Order #${displayId}` })).toBeVisible()
    await expect(page.getByRole('heading', { name: /thank you/i })).not.toBeVisible()
    await expect(page.getByText(product.title).first()).toBeVisible()

    // `variantOptionValues` was dropped by the store response schema until this page needed it,
    // so the line rendering is the assertion that the key survives the wire.
    await expect(page.getByText(product.optionValue.value)).toBeVisible()

    // The address the checkout submitted, back on the record of it — including the country as a
    // name rather than the `US` the page used to print. Scoped to `main`: the footer's market
    // control names the same country, so an unscoped read now matches the shopper's address and
    // the market they are buying in. Narrower than it was, not weaker — it is the address on the
    // order this asserts, and `main` is where that lives.
    const orderDetail = page.getByRole('main')
    await expect(orderDetail.getByText(SHIPPING_ADDRESS.address1)).toBeVisible()
    await expect(orderDetail.getByText(`${SHIPPING_ADDRESS.city}, ${SHIPPING_ADDRESS.province}`)).toBeVisible()
    await expect(orderDetail.getByText(SHIPPING_ADDRESS.countryName)).toBeVisible()
  })

  test('an order delivered where the store no longer sells still names the country', async ({
    page,
    navigate,
    factories,
  }) => {
    await using customer = await factories.create.customer({ hasAccount: true })
    // France is in the ISO table and in no region: the store does not sell there, and the
    // checkout can no longer address a parcel to it. This is the record of one placed when it
    // could — which is the only way the storefront ever holds a country it does not sell to.
    await using order = await factories.create.order({
      order: { customerId: customer.id, email: customer.email, currencyCode: 'usd' },
      shippingAddress: { countryCode: 'fr', address1: '8 Rue de Rivoli', city: 'Paris', postalCode: '75001' },
    })

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/en-US/account', { timeout: 15_000 })

    await navigate({ to: '/account/orders/$orderId', params: { orderId: order.id } })

    // The name, resolved through the whole ISO table rather than the markets the store sells in
    // today. Reading the sellable list here would have printed "FR" — a shopper's own receipt
    // turning into a code because the merchant closed a market afterwards.
    const orderDetail = page.getByRole('main')
    await expect(orderDetail.getByText('8 Rue de Rivoli')).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(orderDetail.getByText('France')).toBeVisible()
    await expect(orderDetail.getByText('FR', { exact: true })).toHaveCount(0)
  })
})
