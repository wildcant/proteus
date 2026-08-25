import { expect, test } from '../setup/test-extend.js'

test.describe('Footer', () => {
  test('carries its link columns and the copyright', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    // The columns render twice — once as accordion triggers, once as static headings — and only
    // one tree is displayed at a given width. Filter on visibility rather than `.first()`, which
    // would keep passing the day one of the two stops rendering.
    const footer = page.locator('footer')
    await expect(footer.getByText('Shop').filter({ visible: true })).toBeVisible()
    await expect(footer.getByText('Account').filter({ visible: true })).toBeVisible()
    await expect(footer.getByText(/Proteus\. All rights reserved/)).toBeVisible()

    // Desktop Chrome is above `sm`, so the columns are open with no trigger to press
    await expect(footer.getByRole('link', { name: 'All products' })).toBeVisible()
    await expect(footer.getByRole('button', { name: 'Shop' })).not.toBeVisible()
  })

  test('the columns collapse into an accordion below sm', async ({ page, authenticate, navigate }) => {
    // Explicit viewport: the project runs Desktop Chrome, where the accordion is display:none.
    await page.setViewportSize({ width: 390, height: 844 })
    await authenticate({ as: 'customer' })
    await navigate({ to: '/' })

    const footer = page.locator('footer')
    const shopTrigger = footer.getByRole('button', { name: 'Shop' })
    await expect(shopTrigger).toBeVisible()

    // Both items start closed — the reason the accordion exists is that five links stacked flat
    // push the copyright most of a screen down
    const allProducts = footer.getByRole('link', { name: 'All products' })
    await expect(allProducts).not.toBeVisible()

    await shopTrigger.click()
    await expect(allProducts).toBeVisible()
    await expect(shopTrigger).toHaveAttribute('aria-expanded', 'true')

    await shopTrigger.click()
    await expect(allProducts).not.toBeVisible()
  })
})
