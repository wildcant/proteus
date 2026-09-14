import { expect, test } from '../setup/test-extend.js'

/**
 * Scanning, which is the whole point of these two lists: what the shop has on one page, and what
 * its orders are holding on the page beside it. Neither offers a way to change a number — stock is
 * set on the variant, and a reservation is written by checkout.
 */
test('inventory journey: scan what the shop has and what its orders hold', async ({
  page,
  authenticate,
  navigate,
  factories,
}) => {
  const sku = `E2E-INV-${Date.now()}`
  await using location = await factories.create.stockLocation({ name: 'Main Warehouse' })
  await using product = await factories.create.product({ status: 'published' })
  await using variant = await factories.create.productVariant({ productId: product.id, sku })
  await using order = await factories.create.order({
    lineItem: { title: 'Oak chair', productTitle: 'Oak chair', variantSku: sku },
  })
  await using inventoryItem = await factories.create.inventoryItem({ sku })
  await using level = await factories.create.inventoryLevel({
    inventoryItemId: inventoryItem.id,
    locationId: location.id,
    stockedQuantity: 12,
    // Written beside the reservation below, because the counter only ever moves with one.
    reservedQuantity: 5,
  })
  await using link = await factories.create.productVariantInventoryItem({
    variantId: variant.id,
    inventoryItemId: inventoryItem.id,
  })
  await using reservation = await factories.create.reservationItem({
    inventoryItemId: inventoryItem.id,
    locationId: location.id,
    quantity: 5,
    lineItemId: order.lineItem.id,
  })
  await authenticate({ as: 'admin' })

  // One Inventory nav entry, with Reservations beneath it.
  await navigate({ to: '/inventory' })
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible()

  const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: sku, exact: true }) })
  await expect(row.getByRole('cell', { name: product.title, exact: true })).toBeVisible()
  // What is on the shelf, what is committed, and what is left — three numbers, not one.
  await expect(row.getByRole('cell', { name: '12', exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: '5', exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: '7', exact: true })).toBeVisible()

  // Read-only: the list offers no way to add or change a number.
  await expect(page.getByRole('link', { name: 'Create' })).toHaveCount(0)

  // The row goes back to the variant, which is where a stock count is corrected.
  await row.getByRole('cell', { name: sku, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/products/${product.id}/variants/${variant.id}`))

  // Reservations are a lens on the same stock: the units, and the order holding them. They sit
  // under the one Inventory nav entry, so reaching them starts from it rather than from a peer.
  await navigate({ to: '/inventory' })
  await page.getByRole('link', { name: 'Reservations' }).click()
  await expect(page.getByRole('heading', { name: 'Reservations' })).toBeVisible()
  const reservationRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: sku, exact: true }) })
  await expect(reservationRow.getByRole('cell', { name: `#${order.displayId}`, exact: true })).toBeVisible()
  await expect(reservationRow.getByRole('cell', { name: '5', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Create' })).toHaveCount(0)

  await reservationRow.getByRole('cell', { name: 'Oak chair', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/orders/${order.id}`))

  void level
  void link
  void reservation
})
