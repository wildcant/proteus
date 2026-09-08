import { BACKEND_TIMEOUT } from '@proteus/testing'
import { expect, test } from '../setup/test-extend.js'
import { fillAddressForm } from '../setup/utils.js'

test.describe('Addresses', () => {
  test('a shopper can add an address, edit it, and remove it again', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/account' })

    await page.getByRole('link', { name: /address book/i }).click()
    await expect(page).toHaveURL(/\/account\/addresses$/)
    await expect(page.getByRole('heading', { name: /address book is empty/i })).toBeVisible()

    await page.getByRole('link', { name: /add an address/i }).click()
    await expect(page).toHaveURL(/\/account\/addresses\/new$/)
    await fillAddressForm(page, { label: 'Home', city: 'Austin' })
    await page.getByRole('button', { name: /^save$/i }).click()

    // The drawer navigates back to the list on success, so the card appearing is also the
    // proof that the unsaved-changes blocker let the navigation through.
    await expect(page).toHaveURL(/\/account\/addresses$/)
    // Scoped to the row: the same address also renders in the Main address panel beside the
    // list, so an unscoped getByText would match twice.
    const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Home' }) })
    await expect(row).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(row.getByText('Austin, TX, 78701')).toBeVisible()
    // The default is no longer a badge — the row's radio reads "Main address" once it holds the
    // slot, and the panel is what echoes it.
    await expect(row.getByText(/^main address$/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: /^main address$/i })).toBeVisible()

    await row.getByRole('link', { name: /^edit$/i }).click()
    await expect(page).toHaveURL(/\/account\/addresses\/cuaddr_[^/]+\/edit$/)
    await page.getByLabel('City').fill('Dallas')
    await page.getByRole('button', { name: /^save$/i }).click()

    await expect(page).toHaveURL(/\/account\/addresses$/)
    await expect(row.getByText('Dallas, TX, 78701')).toBeVisible({ timeout: BACKEND_TIMEOUT })

    await row.getByRole('button', { name: /^delete$/i }).click()
    await page.getByRole('button', { name: /^remove$/i }).click()

    await expect(row).toBeHidden({ timeout: BACKEND_TIMEOUT })
    await expect(page.getByRole('heading', { name: /address book is empty/i })).toBeVisible()
  })

  test('the delivery country is the market’s, and there is no way to change it', async ({
    page,
    authenticate,
    navigate,
  }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/account/addresses/new' })

    // Named, not coded, and already answered — a shopper in the United States market is saving a
    // United States address, and the form says so rather than asking.
    const country = page.getByLabel('Country')
    await expect(country).toHaveValue('United States')
    await expect(country).not.toBeEditable()
    // Not a select at all: there is no list of countries to open, so there is nothing to pick a
    // country the store cannot ship to out of.
    await expect(page.locator('select[name="countryCode"]')).toHaveCount(0)
  })

  test('the book keeps an address from another market, and still shows its country', async ({
    page,
    navigate,
    factories,
  }) => {
    const label = 'Bogotá office'
    await using customer = await factories.create.customer({ hasAccount: true })
    // Saved through the table, because the form cannot make one: it only ever saves into the
    // market the shopper is in. This is the address of a shopper who bought from Colombia before.
    await using _elsewhere = await factories.create.customerAddress({
      customerId: customer.id,
      countryCode: 'co',
      addressName: label,
      address1: 'Calle 93 #11-27',
      city: 'Bogotá',
      postalCode: '110221',
    })

    await navigate({ to: '/login' })
    await page.getByLabel('Email').fill(customer.email)
    await page.getByRole('textbox', { name: 'Password' }).fill(customer.password)
    await page.getByRole('button', { name: /sign in/i }).click()
    await expect(page).toHaveURL('/en-US/account', { timeout: 15_000 })

    // Read in the United States market. The book is the record of what the shopper saved, not a
    // filtered view of where they can buy today — an address that vanished on switching market
    // would read as data the store had thrown away.
    await navigate({ to: '/account/addresses' })
    const row = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: label }) })
    await expect(row).toBeVisible({ timeout: BACKEND_TIMEOUT })
    await expect(row.getByText('Calle 93 #11-27, Bogotá, 110221, CO')).toBeVisible()
  })
})
