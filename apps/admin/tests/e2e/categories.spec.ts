import { expect, test } from '../setup/test-extend.js'

test('a merchant creates a category under a parent, assigns a product, and the store lists it', async ({
  page,
  authenticate,
  navigate,
  factories,
  cleanup,
}) => {
  // Cleanups run last-added first, and `parent_id` restricts the parent's delete, so the parent's is
  // added before the child's. `await using` would dispose it before any cleanup ran.
  const parent = await factories.create.productCategory()
  cleanup.add(() => factories.destroy.productCategory(parent.id))
  // Priced and published, because the store lists only the catalogue its market can quote.
  await using product = await factories.create.productWithPricing()
  await authenticate({ as: 'admin' })

  const name = `E2E Category ${Date.now()}`
  const handle = `e2e-category-${Date.now()}`

  // Create — the parent comes from the drill-down category picker; search names it by its path.
  await navigate({ to: '/categories' })
  await page.getByRole('link', { name: 'Create' }).click()
  await page.getByLabel('Name').fill(name)
  await page.getByLabel('Handle').fill(handle)
  await page.getByRole('button', { name: 'Choose a category' }).click()
  await page.getByRole('textbox', { name: 'Search categories' }).fill(parent.name)
  await page.getByRole('listitem').filter({ hasText: parent.name }).getByRole('checkbox').check()
  // Single choice: choosing closes the list and shows the parent as the one chip.
  await expect(page.getByRole('textbox', { name: 'Search categories' })).toBeHidden()
  await expect(page.getByRole('button', { name: `Remove ${parent.name}` })).toBeVisible()
  await page.getByRole('switch', { name: 'Active' }).click()
  await page.getByRole('button', { name: 'Save' }).click()

  await page.getByRole('link', { name: new RegExp(name) }).click()
  await page.waitForURL(/\/categories\/pcat_/)
  const categoryId = page.url().split('/categories/')[1]?.split(/[/?]/)[0]
  if (!categoryId) throw new Error('no category id in the detail URL')
  cleanup.add(() => factories.destroy.productCategory(categoryId))
  await expect(page.getByText(parent.name, { exact: true })).toBeVisible()

  // Assign — the product picker, then Done sends the product as the one addition.
  await page.getByRole('link', { name: 'Edit products' }).click()
  const picker = page.locator('[role="dialog"]').last()
  await picker.getByPlaceholder('Search...').fill(product.title)
  await picker
    .getByRole('row', { name: new RegExp(product.title) })
    .getByRole('checkbox')
    .check()
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(picker).toBeHidden()
  await expect(page.getByRole('cell', { name: product.title })).toBeVisible()

  // The store lists it under the new category and under its parent, which includes descendants.
  const backendUrl = process.env.VITE_BACKEND_URL
  expect(
    backendUrl,
    'VITE_BACKEND_URL is unset — run the suite through `pnpm --filter admin run test:e2e`',
  ).toBeTruthy()
  for (const categoryHandle of [handle, parent.handle]) {
    const response = await page.request.get(`${backendUrl}/store/products?category=${categoryHandle}`)
    expect(response.ok()).toBe(true)
    const { products } = (await response.json()) as { products: Array<{ id: string }> }
    expect(products.map((listed) => listed.id)).toContain(product.id)
  }
})

test('a merchant organizes the category tree by dragging', async ({ page, authenticate, navigate, factories }) => {
  // Declared parent first, so disposal runs children first: `parent_id` restricts the parent's delete.
  await using parent = await factories.create.productCategory()
  await using tops = await factories.create.productCategory({ parentId: parent.id, rank: 0 })
  await using shoes = await factories.create.productCategory({ parentId: parent.id, rank: 1 })
  await using socks = await factories.create.productCategory({ parentId: parent.id, rank: 2 })
  await authenticate({ as: 'admin' })

  await navigate({ to: '/categories' })
  await page.getByRole('link', { name: 'Organize' }).click()
  await expect(page.getByText('Organize categories')).toBeVisible()

  // Other specs' Categories render alongside, so read only the rows this test made, in page order.
  const ownRows = () =>
    page
      .getByRole('listitem')
      .filter({ hasText: new RegExp(`${tops.name}|${shoes.name}|${socks.name}`) })
      .allInnerTexts()
  const order = async () =>
    (await ownRows()).map((text) => [tops, shoes, socks].find((category) => text.includes(category.name))?.id)

  // From the keyboard: pick up socks, move it up two rows, drop it.
  await page.getByRole('button', { name: `Move ${socks.name}` }).focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Space')
  await expect.poll(order).toEqual([socks.id, tops.id, shoes.id])

  // With the pointer: drag shoes right, under tops, which now sits above it.
  const handle = page.getByRole('button', { name: `Move ${shoes.name}` })
  const box = await handle.boundingBox()
  if (!box) throw new Error('drag handle has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 5 })
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  // Both moves were saved, not just drawn: a fresh load shows them.
  await page.reload()
  await expect.poll(order).toEqual([socks.id, tops.id, shoes.id])
  await navigate({ to: '/categories/$id', params: { id: shoes.id } })
  await expect(page.getByText(`${parent.name} › ${tops.name}`)).toBeVisible()
})
