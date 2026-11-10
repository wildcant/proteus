import { expect, test } from '../setup/test-extend.js'

test.describe('Collection pages', () => {
  test('a shopper opens a collection by its URL and sees its products, not the rest of the catalogue', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    await using collection = await factories.create.productCollection()
    // Priced, because the list is the catalogue this market can quote.
    await using member = await factories.create.productWithPricing()
    await using outsider = await factories.create.productWithPricing()
    await using _membership = await factories.create.productProductCollection({
      productId: member.id,
      collectionId: collection.id,
    })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/collections/$handle', params: { handle: collection.handle } })

    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1, name: collection.title })).toBeVisible()
    await expect(main.getByRole('img', { name: collection.title })).toBeVisible()
    await expect(main.getByText('1 Product')).toBeVisible()
    await expect(main.getByRole('heading', { level: 3, name: member.title })).toBeVisible()
    await expect(main.getByRole('heading', { level: 3, name: outsider.title })).toBeHidden()

    await main.getByRole('heading', { level: 3, name: member.title }).click()
    await expect(page).toHaveURL(new RegExp(`/en-US/products/${member.id}`))
  })

  test('an unknown handle renders the not-found state inside the chrome', async ({ page, authenticate, navigate }) => {
    await authenticate({ as: 'customer' })

    await navigate({ to: '/collections/$handle', params: { handle: 'no-such-collection' } })

    await expect(page.getByRole('heading', { name: "We couldn't find this collection" })).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await page.locator('main').getByRole('link', { name: 'Shop all', exact: true }).click()
    await expect(page).toHaveURL('/en-US')
  })
})
