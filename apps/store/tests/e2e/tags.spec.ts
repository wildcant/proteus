import { expect, test } from '../setup/test-extend.js'

test.describe('Filter by tag', () => {
  test('a shopper narrows a collection by two Tag chips, then removes one', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    // Scoped to a Collection, because the E2E database is shared and the home page's chips would
    // carry every other test's Tags.
    await using collection = await factories.create.productCollection()
    await using cotton = await factories.create.productTag()
    await using leather = await factories.create.productTag()
    // Priced, because the list and its chips are the catalogue this market can quote.
    await using tee = await factories.create.productWithPricing()
    await using boot = await factories.create.productWithPricing()
    await using sock = await factories.create.productWithPricing()
    for (const product of [tee, boot, sock]) {
      await factories.create.productProductCollection({ productId: product.id, collectionId: collection.id })
    }
    await factories.create.productProductTag({ productId: tee.id, tagId: cotton.id })
    await factories.create.productProductTag({ productId: boot.id, tagId: leather.id })
    await authenticate({ as: 'customer' })

    await navigate({ to: '/collections/$handle', params: { handle: collection.handle } })

    const main = page.locator('main')
    const chips = main.getByRole('list', { name: 'Filter by tag' })
    const product = (title: string) => main.getByRole('heading', { level: 3, name: title })
    await expect(main.getByText('3 Products')).toBeVisible()

    await chips.getByRole('button', { name: cotton.value }).click()
    await expect(main.getByText('1 Product', { exact: true })).toBeVisible()
    await expect(product(tee.title)).toBeVisible()
    await expect(product(boot.title)).toBeHidden()
    // The other chip stays on offer: the values ignore the Tags already chosen.
    await chips.getByRole('button', { name: leather.value }).click()
    await expect(main.getByText('2 Products')).toBeVisible()
    await expect(product(tee.title)).toBeVisible()
    await expect(product(boot.title)).toBeVisible()
    await expect(product(sock.title)).toBeHidden()
    // A repeated key, `?tag=a&tag=b`, rather than a JSON array in one.
    await expect.poll(() => new URL(page.url()).searchParams.getAll('tag')).toEqual([cotton.value, leather.value])

    await chips.getByRole('button', { name: `Remove filter ${cotton.value}` }).click()
    await expect(main.getByText('1 Product', { exact: true })).toBeVisible()
    await expect(product(boot.title)).toBeVisible()
    await expect(product(tee.title)).toBeHidden()

    // The choice lives in the URL, so a reload draws the same list.
    await page.reload()
    await expect(main.getByText('1 Product', { exact: true })).toBeVisible()
    await expect(chips.getByRole('button', { name: `Remove filter ${leather.value}` })).toBeVisible()
  })
})
