import type { TestContainer } from '@tests/setup/create-container.js'
import { type Fixtures, test } from '@tests/setup/test-extend.js'
import { confirmInventoryWorkflow } from '../confirm-inventory-workflow.js'

type Services = Fixtures['service']

let container: TestContainer

test.beforeEach(async ({ createTestContainer }) => {
  container = await createTestContainer()
})

/**
 * A cart holding one line item for a freshly stocked variant. Returns the ids the assertions
 * name, so no test lists rows back to learn them.
 */
const stockedCartItem = async (
  service: Services,
  options: { cartId?: string; quantity?: number; stockedQuantity?: number; requiredQuantity?: number } = {},
) => {
  const cartId = options.cartId ?? (await service.create.cart(container)).id
  const { product } = await service.create.product(container)
  const variant = await service.create.productVariant(container, product.id)

  const { inventoryItem, inventoryLevel } = await service.create.variantStock(container, {
    variantId: variant.id,
    level: { stockedQuantity: options.stockedQuantity ?? 10 },
    requiredQuantity: options.requiredQuantity,
  })
  const lineItem = await service.create.lineItem(container, cartId, {
    variantId: variant.id,
    quantity: options.quantity ?? 1,
  })

  return { cartId, variantId: variant.id, lineItem, inventoryItem, inventoryLevel }
}

test.describe('confirmInventoryWorkflow', () => {
  test('reports what each line item needs and where it can come from', async ({ service, expect }) => {
    const { cartId, variantId, lineItem, inventoryItem, inventoryLevel } = await stockedCartItem(service, {
      quantity: 2,
      stockedQuantity: 10,
    })

    const result = await confirmInventoryWorkflow.run({ cartId })

    expect(result).toEqual({
      cartId,
      items: [
        {
          lineItemId: lineItem.id,
          variantId,
          inventoryItemId: inventoryItem.id,
          requiredQuantity: 1,
          quantity: 2,
          locationIds: [inventoryLevel.locationId],
        },
      ],
    })
  })

  test('throws when stock does not cover the line item', async ({ service, expect }) => {
    const { cartId } = await stockedCartItem(service, { quantity: 5, stockedQuantity: 2 })

    await expect(confirmInventoryWorkflow.run({ cartId })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })

  test('counts stock pooled across locations', async ({ service, expect }) => {
    const { cartId, inventoryItem, inventoryLevel } = await stockedCartItem(service, {
      quantity: 8,
      stockedQuantity: 5,
    })
    const second = await service.create.inventoryLevel(container, inventoryItem.id, { stockedQuantity: 5 })

    const result = await confirmInventoryWorkflow.run({ cartId })

    expect(result.items[0]?.locationIds.sort()).toEqual([inventoryLevel.locationId, second.locationId].sort())
  })

  test('skips a line item with no variant', async ({ service, expect }) => {
    const { id: cartId } = await service.create.cart(container)
    await service.create.lineItem(container, cartId, { variantId: null })

    const result = await confirmInventoryWorkflow.run({ cartId })

    expect(result.items).toEqual([])
  })

  test('multiplies the ordered quantity by the units each one consumes', async ({ service, expect }) => {
    // Needs 2 × 3 = 6, only 5 in stock.
    const { cartId } = await stockedCartItem(service, { quantity: 2, requiredQuantity: 3, stockedQuantity: 5 })

    await expect(confirmInventoryWorkflow.run({ cartId })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })

  test('throws when any one item in a multi-item cart is short', async ({ service, expect }) => {
    const { cartId } = await stockedCartItem(service, { quantity: 1, stockedQuantity: 5 })
    await stockedCartItem(service, { cartId, quantity: 100, stockedQuantity: 3 })

    await expect(confirmInventoryWorkflow.run({ cartId })).rejects.toThrow(
      'Some variant does not have the required inventory',
    )
  })
})
