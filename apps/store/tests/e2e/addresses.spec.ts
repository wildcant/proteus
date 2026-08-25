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
})
