import { expect, test } from '../setup/test-extend.js'

test.describe('Shop by category', () => {
  // Entered by URL rather than from the rail: the rail shows the store's menu, which
  // `header.spec.ts` sets and covers, on a store every spec running alongside shares.
  test('a shopper opens a category, goes down a child chip, to a product', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    // Disposed child-first: a Category with children cannot be deleted.
    await using parent = await factories.create.productCategory({ description: 'Everything for the season' })
    await using child = await factories.create.productCategory({ parentId: parent.id })
    // Priced, because the list is the catalogue this market can quote.
    await using product = await factories.create.productWithPricing()
    await using _membership = await factories.create.productProductCategory({
      productId: product.id,
      categoryId: child.id,
    })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/categories/$handle', params: { handle: parent.handle } })

    // The parent's page lists its descendants' products too: the product sits only in the child.
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1, name: parent.name })).toBeVisible()
    await expect(main.getByText('Everything for the season')).toBeVisible()
    await expect(main.getByRole('heading', { level: 3, name: product.title })).toBeVisible()

    // A chip per child; the child's page carries a breadcrumb back to the parent.
    await main.getByRole('link', { name: child.name, exact: true }).click()
    await expect(page).toHaveURL(`/en-US/categories/${child.handle}`)
    await expect(main.getByRole('heading', { level: 1, name: child.name })).toBeVisible()
    await expect(
      main.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: parent.name }),
    ).toBeVisible()

    await main.getByRole('heading', { level: 3, name: product.title }).click()
    await expect(page).toHaveURL(new RegExp(`/en-US/products/${product.handle}`))
    await expect(page.getByRole('heading', { name: product.title })).toBeVisible()
  })

  // One journey for both scoped pages: they share the not-found state and differ only in its copy.
  test('a category or collection handle the store does not show renders the not-found state inside the chrome', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    await using hidden = await factories.create.productCategory({ isActive: false })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/categories/$handle', params: { handle: hidden.handle } })

    await expect(page.getByRole('heading', { name: "We couldn't find this category" })).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await page.locator('main').getByRole('link', { name: 'Shop all', exact: true }).click()
    await expect(page).toHaveURL('/en-US')

    await navigate({ to: '/collections/$handle', params: { handle: 'no-such-collection' } })

    await expect(page.getByRole('heading', { name: "We couldn't find this collection" })).toBeVisible()
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('footer')).toBeVisible()
    await page.locator('main').getByRole('link', { name: 'Shop all', exact: true }).click()
    await expect(page).toHaveURL('/en-US')
  })
})
