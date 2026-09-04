import { expect, test } from '../setup/test-extend.js'
import { disposeCartAfterTest, fillAddressForm, fillShippingAddress } from '../setup/utils.js'

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

    disposeCartAfterTest(page, factories, cleanup)

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

    // 3. Check out from the panel. One page, no steps — a guest sees every section at once,
    // Contact included.
    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('heading', { name: 'Contact' })).toBeVisible()

    // 4. Email, committed by the blur rather than by a button
    const guestEmail = 'guest-checkout@example.com'
    await page.getByLabel('Email').fill(guestEmail)
    await page.getByLabel('Email').blur()

    // 5. Address, likewise. `fillShippingAddress` ends on a blur; the rates appearing below is
    // what proves the address reached the cart.
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible()
    await fillShippingAddress(page)

    // 6. Shipping method: select the option this test created — other tests' options are listed too
    const shippingRadio = page.getByRole('radio', { name: shipping.name })
    await expect(shippingRadio).toBeVisible({ timeout: 10000 })
    await shippingRadio.click()
    await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10000 })

    // 7. Payment: select Manual Payment provider
    const paymentRadio = page.getByRole('radio', { name: /manual payment/i })
    await expect(paymentRadio).toBeVisible({ timeout: 10000 })
    await paymentRadio.click()

    // 8. The page's one submit
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

    disposeCartAfterTest(page, factories, cleanup)

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
    await expect(page).toHaveURL('/en-US/account', { timeout: 15000 })

    // 3. Verify cart was transferred — the bag on /account still carries the guest's item
    await page.getByLabel('Cart', { exact: true }).click()
    await expect(cartPanel.getByText(product.title)).toBeVisible()

    // 4. Check out. With no steps left, "authenticated skips contact" is entirely the absence of
    // the Contact section — there is no step in the URL to say it instead. What stands in its
    // place is the account row, which reads the email back rather than asking for it again.
    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    await expect(page).toHaveURL(/\/checkout/)
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Contact' })).not.toBeVisible()
    await expect(page.getByText(customer.email)).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveCount(0)

    // Signing out is reachable from that row, and it is the only thing behind the menu.
    await page.getByRole('button', { name: 'Account options' }).click()
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden()

    // 5. Address
    await fillShippingAddress(page)

    // 6. Shipping method: select the option this test created — other tests' options are listed too
    const shippingRadio = page.getByRole('radio', { name: shipping.name })
    await expect(shippingRadio).toBeVisible({ timeout: 10000 })
    await shippingRadio.click()
    await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10000 })

    // 7. Payment: select Manual Payment provider
    const paymentRadio = page.getByRole('radio', { name: /manual payment/i })
    await expect(paymentRadio).toBeVisible({ timeout: 10000 })
    await paymentRadio.click()

    // 8. Place the order
    await page.getByRole('button', { name: /place order/i }).click()

    // 9. Order confirmation — email should be the customer's registered email
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Your order was placed successfully.')).toBeVisible()
    await expect(page.getByText(customer.email).first()).toBeVisible()
  })

  test('shipping methods are gated on the address that quotes them', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()

    // Before an address: the placeholder, and no rates. This is the bug the ticket fixes — the
    // section used to answer "No shipping options available for your address" to a shopper who
    // had entered no address, because the endpoint fell back to its `?? 'us'` default.
    await expect(page.getByText('Enter your shipping address to view available shipping methods.')).toBeVisible()
    await expect(page.getByRole('radio', { name: shipping.name })).toHaveCount(0)

    // After it: the rates, quoted for what was entered.
    await fillShippingAddress(page)
    await expect(page.getByRole('radio', { name: shipping.name })).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Enter your shipping address to view available shipping methods.')).toBeHidden()
  })

  test('place order validates every section before it sends anything', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible()

    // Nothing filled in. The page refuses rather than letting `complete-cart` answer, and it marks
    // the fields where they are — the shopper is not sent looking for them.
    await page.getByRole('button', { name: /place order/i }).click()
    // Every failing section at once, from its own schema — not the first thing the backend noticed.
    // There is no summary line by the button: the message lives under the field that failed.
    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Address is required')).toBeVisible()
    await expect(page.getByText('Select a payment method')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Address', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    // Optional in the schema, so it must not be marked — otherwise the gate is just "everything".
    await expect(page.getByLabel('Phone')).toHaveAttribute('aria-invalid', 'false')
    // The shipping section has no rates to refuse yet, so it asks for an address instead of erroring.
    await expect(page.getByText('Select a shipping method')).toHaveCount(0)
    await expect(page).toHaveURL(/\/checkout/)

    // Valid fields, but no shipping method: the sections that were answered stop complaining, and a
    // different refusal takes their place. Still not a request.
    await page.getByLabel('Email').fill('validate@example.com')
    await page.getByLabel('Email').blur()
    await fillShippingAddress(page)
    await expect(page.getByText('Email is required')).toHaveCount(0)
    await expect(page.getByText('Address is required')).toHaveCount(0)
    await expect(page.getByRole('radio', { name: shipping.name })).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByText('Select a shipping method')).toBeVisible()

    // Then no payment method. Waiting for the summary to stop asking for an address is what says
    // the method reached the cart — press before that and the gate still reports the shipping one.
    await page.getByRole('radio', { name: shipping.name }).click()
    await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10000 })
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByText('Select a shipping method')).toHaveCount(0)
    await expect(page.getByText('Select a payment method')).toBeVisible()

    // With everything answered it goes through, which is what proves the gate was the only thing
    // stopping it.
    await page.getByRole('radio', { name: /manual payment/i }).click()
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
  })

  test('a saved default address is shipped to without retyping it', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()
    await using customer = await factories.create.customer({ hasAccount: true })

    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/en-US/account', { timeout: 15000 })

    // Saved through the address book, marked as the main one — there is no address factory, and
    // the book is the only thing that writes one.
    await navigate({ to: '/account/addresses/new' })
    await fillAddressForm(page, { label: 'Home', city: 'Austin' })
    await page.getByRole('button', { name: 'Save' }).click()
    // By the list row, not `.first()`: the book prints the same address twice — once in the Main
    // address panel and once in the list — so an unscoped match has two candidates.
    const savedAddress = page.getByRole('listitem').filter({ hasText: '123 Main St, Austin' })
    await expect(savedAddress).toBeVisible({ timeout: 10000 })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()

    // The default is applied on arrival, so there is nothing to type and the rates are already
    // quoted for it. That second part is the assertion that matters: it proves the address reached
    // the cart rather than merely being drawn on the page.
    await expect(page.getByText('Ship to')).toBeVisible()
    await expect(page.getByText('123 Main St, Austin, TX, 78701, US')).toBeVisible()
    await expect(page.getByText('Default')).toBeVisible()
    await expect(page.getByLabel('Address', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: shipping.name })).toBeVisible({ timeout: 15000 })

    // Editing goes to the address book's own drawer, over a checkout that stays mounted.
    await page.getByRole('button', { name: 'Address options' }).click()
    await page.getByRole('link', { name: 'Edit address' }).click()
    await expect(page).toHaveURL(/\/checkout\/addresses\/.+\/edit/)
    await expect(page.getByRole('heading', { name: 'Edit address' })).toBeVisible()
    await page.getByLabel('City').fill('Dallas')
    await page.getByRole('button', { name: 'Save' }).click()

    // Back on a checkout that never went away, now shipping to the corrected address.
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByText('123 Main St, Dallas, TX, 78701, US')).toBeVisible({ timeout: 10000 })

    await page.getByRole('radio', { name: shipping.name }).click()
    await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10000 })
    await page.getByRole('radio', { name: /manual payment/i }).click()
    await page.getByRole('button', { name: /place order/i }).click()
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
  })

  test('on a phone the summary is a disclosure carrying the total', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })

    disposeCartAfterTest(page, factories, cleanup)

    await page.setViewportSize({ width: 390, height: 844 })
    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()

    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()

    // Two trees for one summary, so 'Order summary' is in the DOM twice — but the desktop panel is
    // `display: none` at this width, which takes it out of the accessibility tree, so the role
    // query finds only the disclosure this viewport actually renders.
    const trigger = page.getByRole('button', { name: /^order summary/i })
    await expect(trigger).toBeVisible()

    // Collapsed, the total is still readable — and reading it *out of the trigger* is the claim,
    // rather than that the number appears somewhere on the page.
    await expect(trigger).toContainText('$25.00')
    // `visible: true` again, and for the same reason: the desktop panel is `display: none` here,
    // not absent, so an unfiltered count would find its copy of the row and never be zero.
    await expect(page.getByText(product.title).filter({ visible: true })).toHaveCount(0)

    await trigger.click()
    await expect(page.getByText(product.title).filter({ visible: true })).toBeVisible()
  })

  test('the picker offers only what this market delivers to, while the book keeps everything', async ({
    page,
    navigate,
    factories,
    cleanup,
  }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using customer = await factories.create.customer({ hasAccount: true })
    await using _home = await factories.create.customerAddress({
      customerId: customer.id,
      countryCode: 'us',
      addressName: 'Home',
      address1: '742 Evergreen Terrace',
      city: 'Austin',
      province: 'TX',
      postalCode: '78701',
      isDefaultShipping: true,
      isDefaultBilling: true,
    })
    // The address the storefront can no longer be made to save, which is the point: a shopper who
    // bought from Colombia before still has it, and is now shopping in the United States.
    await using _abroad = await factories.create.customerAddress({
      customerId: customer.id,
      countryCode: 'co',
      addressName: 'Bogotá office',
      address1: 'Calle 93 #11-27',
      city: 'Bogotá',
      postalCode: '110221',
    })

    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/en-US/account', { timeout: 15000 })

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()

    // Only the deliverable one is offered. Listing the other would be inviting a shopper to fill
    // in a whole checkout before being told the store cannot ship there.
    await expect(page.getByText('Ship to')).toBeVisible()
    await expect(page.getByText('742 Evergreen Terrace, Austin, TX, 78701, US')).toBeVisible()
    await expect(page.getByText('Calle 93 #11-27, Bogotá, 110221, CO')).toHaveCount(0)

    // The other half of the same claim, and the reason the filter is a filter rather than a
    // deletion: the book still holds both. Nothing was thrown away to narrow the checkout.
    await navigate({ to: '/account/addresses' })
    await expect(page.getByText('742 Evergreen Terrace, Austin, TX, 78701, US').first()).toBeVisible()
    await expect(page.getByText('Calle 93 #11-27, Bogotá, 110221, CO')).toBeVisible()
  })

  test('billing may be a country the store does not ship to', async ({ page, navigate, factories, cleanup }) => {
    await using product = await factories.create.productWithPricing({ price: { amount: '25.00' } })
    await using shipping = await factories.create.shippingOptionWithZone()

    disposeCartAfterTest(page, factories, cleanup)

    await navigate({ to: '/products/$productId', params: { productId: product.id } })
    await page.getByRole('button', { name: /add to cart/i }).click()
    const cartPanel = page.locator('[data-slot="drawer-popup"]')
    await expect(cartPanel).toBeVisible()
    await cartPanel.getByRole('link', { name: /checkout/i }).click()

    await page.getByLabel('Email').fill('billing-abroad@example.com')
    await page.getByLabel('Email').blur()
    await expect(page.getByRole('heading', { name: 'Delivery' })).toBeVisible()
    await fillShippingAddress(page)

    await page.getByRole('checkbox', { name: 'Billing address same as shipping' }).uncheck()
    const billing = page.getByRole('region', { name: 'Billing address' })

    // The whole ISO table, not the two markets the store sells in. A card is registered where its
    // holder banks, and refusing that country would decline a card that was going to work.
    const countries = billing.getByLabel('Country').locator('option')
    await expect(countries.filter({ hasText: 'France' })).toHaveCount(1)
    await expect(countries.filter({ hasText: 'Japan' })).toHaveCount(1)

    await billing.getByLabel('Country').selectOption('fr')
    await billing.getByLabel('Address', { exact: true }).fill('8 Rue de Rivoli')
    await billing.getByLabel('City').fill('Paris')
    await billing.getByLabel('Postal code').fill('75001')

    const shippingRadio = page.getByRole('radio', { name: shipping.name })
    await expect(shippingRadio).toBeVisible({ timeout: 10000 })
    await shippingRadio.click()
    await expect(page.getByRole('complementary').getByText('Enter shipping address')).toBeHidden({ timeout: 10000 })
    await page.getByRole('radio', { name: /manual payment/i }).click()
    await page.getByRole('button', { name: /place order/i }).click()

    // Accepted — a French billing country did not stop the order. And the parcel still goes where
    // the market said it would, which is what makes the two fields separate questions.
    await expect(page.getByRole('heading', { name: /thank you/i })).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('main').getByText('United States')).toBeVisible()
  })
})
