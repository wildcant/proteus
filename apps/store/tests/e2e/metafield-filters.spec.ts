import { expect, test } from '../setup/test-extend.js'

test.describe('Filter by metafield', () => {
  test('a shopper narrows a collection by Género and Tipo, sees what is left, then clears them', async ({
    page,
    authenticate,
    navigate,
    factories,
  }) => {
    // Scoped to a Collection, because the E2E database is shared: a filter only shows where the
    // products in view hold its values, so other tests' definitions stay off this page.
    await using collection = await factories.create.productCollection()
    await using genero = await factories.create.productMetafieldDefinition({ filterable: true, rank: 0 })
    await using tipo = await factories.create.productMetafieldDefinition({ filterable: true, rank: 1 })
    // Priced, because the list and its filters are the catalogue this market can quote.
    await using blouse = await factories.create.productWithPricing()
    await using skirt = await factories.create.productWithPricing()
    await using boot = await factories.create.productWithPricing()
    for (const product of [blouse, skirt, boot]) {
      await factories.create.productProductCollection({ productId: product.id, collectionId: collection.id })
    }
    const hold = (productId: string, definitionId: string, values: string[]) =>
      factories.create.productMetafield({ productId, definitionId, values })
    await hold(blouse.id, genero.id, ['women'])
    await hold(blouse.id, tipo.id, ['tops'])
    await hold(skirt.id, genero.id, ['women'])
    await hold(skirt.id, tipo.id, ['bottoms'])
    await hold(boot.id, genero.id, ['men'])
    await hold(boot.id, tipo.id, ['shoes'])
    await authenticate({ as: 'customer' })

    await navigate({ to: '/collections/$handle', params: { handle: collection.handle } })

    const main = page.locator('main')
    const filters = main.getByRole('group', { name: 'Filters' })
    const product = (title: string) => main.getByRole('heading', { level: 3, name: title })
    const menu = (name: string) => page.getByRole('dialog', { name })
    await expect(main.getByText('3 Products')).toBeVisible()

    await filters.getByRole('button', { name: genero.name }).click()
    await menu(genero.name).getByRole('checkbox', { name: 'women (2)' }).click()
    await expect(main.getByText('2 Products')).toBeVisible()
    await expect(product(boot.title)).toBeHidden()
    // The trigger names the choice, as the reference's does.
    await expect(filters.getByRole('button', { name: `${genero.name}: women` })).toBeVisible()
    await page.keyboard.press('Escape')

    // Tipo now counts within women: shoes would leave nothing, so it is there but disabled.
    await filters.getByRole('button', { name: tipo.name }).click()
    await expect(menu(tipo.name).getByRole('checkbox', { name: 'shoes (0)' })).toBeDisabled()
    await menu(tipo.name).getByRole('checkbox', { name: 'tops (1)' }).click()
    await expect(main.getByText('1 Product', { exact: true })).toBeVisible()
    await expect(product(blouse.title)).toBeVisible()
    await expect(product(skirt.title)).toBeHidden()
    // Two values of one metafield widen the list again.
    await menu(tipo.name).getByRole('checkbox', { name: 'bottoms (1)' }).click()
    await expect(main.getByText('2 Products')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect
      .poll(() => new URL(page.url()).searchParams.getAll('filter'))
      .toEqual([`${genero.key}:women`, `${tipo.key}:tops`, `${tipo.key}:bottoms`])

    // The choice lives in the URL, so a reload draws the same list.
    await page.reload()
    await expect(main.getByText('2 Products')).toBeVisible()

    await filters.getByRole('button', { name: 'Clear all' }).click()
    await expect(main.getByText('3 Products')).toBeVisible()
    await expect(filters.getByRole('button', { name: 'Clear all' })).toBeHidden()
  })
})
