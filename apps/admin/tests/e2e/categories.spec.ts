import { expect, test } from '../setup/test-extend.js'

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
