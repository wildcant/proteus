import type { TestApi } from '@tests/setup/create-api.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import inventoryItemDefinitions from '../definitions.js'
import type * as inventoryItemRoutes from '../route.js'

type Services = Fixtures['service']

let api: TestApi

test.beforeEach(async ({ createApi }) => {
  api = await createApi({ definitions: inventoryItemDefinitions })
})

type InventoryList = typeof inventoryItemRoutes.GetOutput

/** A tracked variant holding `stocked` units at the shop's one location, `reserved` of them sold. */
const stockedVariant = async (
  service: Services,
  locationId: string,
  variant: { productId: string; sku: string; stocked: number; reserved?: number },
) => {
  const created = await service.create.productVariant(api.container, variant.productId, { sku: variant.sku })
  const { inventoryItem } = await service.create.variantStock(api.container, {
    variantId: created.id,
    level: { locationId, stockedQuantity: variant.stocked },
  })
  if (variant.reserved) {
    await service.create.reservedStock(api.container, {
      inventoryItemId: inventoryItem.id,
      locationId,
      quantity: variant.reserved,
      lineItemId: `orderli_${variant.sku}`,
    })
  }

  return created
}

test.describe('GET /admin/inventory-items', () => {
  test('lists every tracked variant with what is on the shelf, committed and left', async ({ service, expect }) => {
    const { id: locationId } = await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container, { title: 'Chair' })
    const oak = await stockedVariant(service, locationId, {
      productId: product.id,
      sku: 'CHAIR-OAK',
      stocked: 12,
      reserved: 5,
    })
    // Untracked: no Inventory Item, no link, and nothing for the list to count.
    await service.create.productVariant(api.container, product.id, { manageInventory: false })

    const { status, body } = await api.get<InventoryList>('/admin/inventory-items')

    expect(status).toBe(200)
    expect(body.count).toBe(1)
    expect(body.inventoryItems).toEqual([
      expect.objectContaining({
        productId: product.id,
        productTitle: 'Chair',
        variantId: oak.id,
        variantTitle: oak.title,
        sku: 'CHAIR-OAK',
        stockedQuantity: 12,
        reservedQuantity: 5,
        availableQuantity: 7,
      }),
    ])
  })

  test('sorts on the quantity columns', async ({ service, expect }) => {
    const { id: locationId } = await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container, { title: 'Chair' })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'OAK', stocked: 4 })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'ASH', stocked: 20 })
    await stockedVariant(service, locationId, {
      productId: product.id,
      sku: 'ELM',
      stocked: 30,
      reserved: 29,
    })

    const ascending = await api.get<InventoryList>('/admin/inventory-items?order=availableQuantity')
    const descending = await api.get<InventoryList>('/admin/inventory-items?order=-stockedQuantity')

    expect(ascending.body.inventoryItems.map((item) => item.sku)).toEqual(['ELM', 'OAK', 'ASH'])
    expect(descending.body.inventoryItems.map((item) => item.sku)).toEqual(['ELM', 'ASH', 'OAK'])
  })

  test('filters to what is at or below the store threshold', async ({ service, factories, expect }) => {
    await using _store = await factories.create.store({ name: 'Proteus', lowStockThreshold: 5 })
    const { id: locationId } = await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container, { title: 'Chair' })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'AT', stocked: 5 })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'BELOW', stocked: 1 })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'ABOVE', stocked: 6 })
    // Above the threshold on the shelf, at it once its orders are counted.
    await stockedVariant(service, locationId, {
      productId: product.id,
      sku: 'COMMITTED',
      stocked: 9,
      reserved: 4,
    })

    const { body } = await api.get<InventoryList>('/admin/inventory-items?lowStock=true')
    const unfiltered = await api.get<InventoryList>('/admin/inventory-items')

    expect(body.count).toBe(3)
    expect(body.inventoryItems.map((item) => item.sku).sort()).toEqual(['AT', 'BELOW', 'COMMITTED'])
    // The same answer rides on every row, so the list can say which ones are low without filtering.
    expect(
      unfiltered.body.inventoryItems
        .filter((item) => item.lowStock)
        .map((item) => item.sku)
        .sort(),
    ).toEqual(['AT', 'BELOW', 'COMMITTED'])
  })

  test('returns nothing rather than erroring when the store has set no threshold', async ({
    service,
    factories,
    expect,
  }) => {
    await using _store = await factories.create.store({ name: 'Proteus', lowStockThreshold: null })
    const { id: locationId } = await service.create.stockLocation(api.container)
    const { product } = await service.create.product(api.container, { title: 'Chair' })
    await stockedVariant(service, locationId, { productId: product.id, sku: 'OAK', stocked: 0 })

    const filtered = await api.get<InventoryList>('/admin/inventory-items?lowStock=true')
    const unfiltered = await api.get<InventoryList>('/admin/inventory-items')

    expect(filtered.status).toBe(200)
    expect(filtered.body.inventoryItems).toEqual([])
    expect(filtered.body.count).toBe(0)
    expect(unfiltered.body.count).toBe(1)
    expect(unfiltered.body.inventoryItems.every((item) => item.lowStock)).toBe(false)
  })
})
