import { ErrorTypes } from '@core/errors/app-error.js'
import type { StockLocationDTO } from '@core/types/stock-location/common.js'
import type { AdminCreateProductVariantBody } from '@proteus/http-schemas/admin'
import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { assertDefined } from '@tests/utils/assert-defined.js'
import { createProductVariantsWorkflow } from '../create-product-variants.js'
import { deleteProductVariantWorkflow } from '../delete-product-variant.js'
import { updateProductVariantWorkflow } from '../update-product-variant.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/** The shop's one Stock Location, which every level a variant is born with is written against. */
const theStockLocation = (service: Services): Promise<StockLocationDTO> => service.create.stockLocation(container)

/** A variant created the way the admin creates one — through the workflow, not the service. */
const createVariant = async (service: Services, body: Partial<AdminCreateProductVariantBody> = {}) => {
  const { product } = await service.create.product(container)
  const [variant] = await createProductVariantsWorkflow.run({
    productId: product.id,
    variants: [{ optionValues: {}, ...body }],
  })
  assertDefined(variant)

  return { product, variant }
}

const linksFor = (service: Services, variantId: string) =>
  service.read.linkRepo(container, 'productVariantInventoryItem').findByVariantIds([variantId])

test.describe('createProductVariantsWorkflow', () => {
  test('a tracked variant is born with an inventory item, a link and a level holding nothing', async ({
    service,
    expect,
  }) => {
    const location = await theStockLocation(service)
    const { product, variant } = await createVariant(service, {
      sku: 'ENAMEL-MUG',
      material: 'enamel',
      originCountry: 'co',
      hsCode: '6912',
      midCode: 'mid',
      weight: 340.4,
    })

    // Seeded from the variant, which is what makes the item recognisable in the inventory list.
    // The title is the product's because a variant of a product with no options takes it.
    const [item] = await service.read.inventoryItems(container, { sku: 'ENAMEL-MUG' })
    expect(item).toMatchObject({
      sku: 'ENAMEL-MUG',
      title: product.title,
      description: product.title,
      material: 'enamel',
      originCountry: 'co',
      hsCode: '6912',
      midCode: 'mid',
      weight: 340,
      requiresShipping: true,
    })
    assertDefined(item)

    expect(await linksFor(service, variant.id)).toEqual([
      expect.objectContaining({ inventoryItemId: item.id, requiredQuantity: 1 }),
    ])

    // The level is the divergence from Medusa: without it the variant has nowhere to put a number.
    expect(await service.read.inventoryLevels(container, { inventoryItemId: item.id })).toEqual([
      expect.objectContaining({ locationId: location.id, stockedQuantity: 0, reservedQuantity: 0 }),
    ])
  })

  test('an untracked variant is born with no inventory at all', async ({ service, expect }) => {
    await theStockLocation(service)
    const { variant } = await createVariant(service, { sku: 'MADE-TO-ORDER', manageInventory: false })

    // A made-to-order item is permanently buyable, so an item and a level would be a number
    // nothing reads and a row the inventory list would have to hide.
    expect(await service.read.inventoryItems(container, { sku: 'MADE-TO-ORDER' })).toEqual([])
    expect(await linksFor(service, variant.id)).toEqual([])
  })

  test('a shop with no Stock Location still gets the item and the link', async ({ service, expect }) => {
    // Nothing seeds a location into a bare database, and refusing the variant outright would make
    // the catalogue unbuildable before the warehouse exists. The variant is still refused at
    // checkout — stocked at no location — so the gap is not silent.
    const { variant } = await createVariant(service, { sku: 'NO-WAREHOUSE' })

    const [item] = await service.read.inventoryItems(container, { sku: 'NO-WAREHOUSE' })
    assertDefined(item)
    expect(await linksFor(service, variant.id)).toHaveLength(1)
    expect(await service.read.inventoryLevels(container, { inventoryItemId: item.id })).toEqual([])
  })
})

test.describe('updateProductVariantWorkflow', () => {
  /** A tracked variant with units on the shelf — the state both halves of the toggle act on. */
  const createStockedVariant = async (service: Services, stockedQuantity: number) => {
    const location = await theStockLocation(service)
    const { variant } = await createVariant(service, { sku: `STOCKED-${stockedQuantity}` })

    const [link] = await linksFor(service, variant.id)
    assertDefined(link)
    await service.update.inventoryLevel(container, link.inventoryItemId, location.id, stockedQuantity)

    return { variant, location, inventoryItemId: link.inventoryItemId }
  }

  test('untracking dismisses the link and hides the inventory item', async ({ service, expect }) => {
    const { variant, inventoryItemId } = await createStockedVariant(service, 4)

    await updateProductVariantWorkflow.run({ variantId: variant.id, data: { manageInventory: false } })

    expect(await linksFor(service, variant.id)).toEqual([])
    expect(await service.read.inventoryItems(container, { id: inventoryItemId })).toEqual([])
    // Hidden rather than gone — the stock number is what re-tracking has to find again.
    expect(await service.read.inventoryItems(container, { id: inventoryItemId }, { withDeleted: true })).toHaveLength(1)
  })

  test('untracking is refused while an order holds the stock, and hides nothing', async ({ service, expect }) => {
    const { variant, location, inventoryItemId } = await createStockedVariant(service, 4)
    const reservation = await service.create.reservedStock(container, {
      inventoryItemId,
      locationId: location.id,
      quantity: 2,
      lineItemId: 'orderli_held',
    })

    const error = await updateProductVariantWorkflow
      .run({ variantId: variant.id, data: { manageInventory: false } })
      .catch((raised) => raised)

    // Hiding the item would hide its reservations with it, by the same cascade — a paid order
    // holding units nothing can fulfil.
    expect(error.cause).toMatchObject({ type: ErrorTypes.NOT_ALLOWED })
    expect(error.message).toContain(variant.id)
    expect(error.message).toContain(reservation.id)
    expect(error.message).toContain('orderli_held')

    expect(await linksFor(service, variant.id)).toHaveLength(1)
    expect(await service.read.inventoryItems(container, { id: inventoryItemId })).toHaveLength(1)
    // The variant update is unwound with the rest, so the shopkeeper is not left looking at a
    // variant the screen calls untracked and the checkout still tracks.
    expect(await service.read.productVariant(container, variant.id)).toMatchObject({ manageInventory: true })
  })

  test('tracking again brings back the link, the item and the stock number', async ({ service, expect }) => {
    const { variant, inventoryItemId } = await createStockedVariant(service, 7)
    await updateProductVariantWorkflow.run({ variantId: variant.id, data: { manageInventory: false } })

    await updateProductVariantWorkflow.run({ variantId: variant.id, data: { manageInventory: true } })

    // Medusa orphans the item on untrack and creates nothing on re-track, so a variant untracked
    // once can never be tracked again there. Here the toggle is lossless both ways.
    expect(await linksFor(service, variant.id)).toEqual([
      expect.objectContaining({ inventoryItemId, requiredQuantity: 1 }),
    ])
    expect(await service.read.inventoryItems(container, { id: inventoryItemId })).toHaveLength(1)
    expect(await service.read.availableQuantity(container, inventoryItemId)).toBe(7)
  })

  test('tracking a variant that was created untracked makes its inventory from scratch', async ({
    service,
    expect,
  }) => {
    const location = await theStockLocation(service)
    const { variant } = await createVariant(service, { sku: 'LATE-TRACKED', manageInventory: false })

    await updateProductVariantWorkflow.run({ variantId: variant.id, data: { manageInventory: true } })

    // There is nothing hidden to restore, and a tracked variant with no inventory item is refused
    // at checkout — so the toggle has to make one rather than leave the variant unsellable.
    const [link] = await linksFor(service, variant.id)
    assertDefined(link)
    expect(await service.read.inventoryLevels(container, { inventoryItemId: link.inventoryItemId })).toEqual([
      expect.objectContaining({ locationId: location.id, stockedQuantity: 0 }),
    ])
  })

  test('an edit that does not touch tracking leaves the inventory alone', async ({ service, expect }) => {
    const { variant, inventoryItemId } = await createStockedVariant(service, 5)

    await updateProductVariantWorkflow.run({ variantId: variant.id, data: { material: 'stoneware' } })

    expect(await linksFor(service, variant.id)).toHaveLength(1)
    expect(await service.read.availableQuantity(container, inventoryItemId)).toBe(5)
  })
})

test.describe('deleteProductVariantWorkflow', () => {
  test('takes the inventory item with it, unless another variant still links to it', async ({ service, expect }) => {
    await theStockLocation(service)
    const { product, variant } = await createVariant(service, { sku: 'SHARED-ITEM' })
    const [link] = await linksFor(service, variant.id)
    assertDefined(link)

    // A second variant pointed at the same item, so the first deletion has something in its way.
    const sharer = await service.create.productVariant(container, product.id)
    await service.read
      .linkRepo(container, 'productVariantInventoryItem')
      .create({ variantId: sharer.id, inventoryItemId: link.inventoryItemId })

    await deleteProductVariantWorkflow.run({ variantId: variant.id })

    expect(await service.read.inventoryItems(container, { id: link.inventoryItemId })).toHaveLength(1)

    await deleteProductVariantWorkflow.run({ variantId: sharer.id })

    // The last link went, so the item goes with it and the inventory list stops showing a row
    // that points at nothing.
    expect(await service.read.inventoryItems(container, { id: link.inventoryItemId })).toEqual([])
  })
})
