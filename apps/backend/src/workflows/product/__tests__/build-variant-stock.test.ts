import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { test } from '@tests/setup/test-extend.js'
import { buildVariantStock } from '../utils/build-variant-stock.js'

const link = (variantId: string, inventoryItemId: string, requiredQuantity = 1): ProductVariantInventoryItemDTO => ({
  id: `pvitem_${variantId}_${inventoryItemId}`,
  variantId,
  inventoryItemId,
  requiredQuantity,
  createdAt: new Date(),
  deletedAt: null,
})

test.describe('buildVariantStock', () => {
  test('a variant is in stock when its item covers the required quantity', ({ expect }) => {
    const result = buildVariantStock([link('var_1', 'item_1', 2)], new Map([['item_1', 2]]))

    expect(result.get('var_1')).toBe(true)
  })

  test('a variant is out of stock when its item falls short', ({ expect }) => {
    const result = buildVariantStock([link('var_1', 'item_1', 3)], new Map([['item_1', 2]]))

    expect(result.get('var_1')).toBe(false)
  })

  test('every item must be covered, not just one', ({ expect }) => {
    // The rule this function exists for: a variant needing several items is only buyable when
    // all of them are covered. An `Array.some` would wrongly report this one as in stock.
    const links = [link('var_1', 'item_1'), link('var_1', 'item_2')]

    const result = buildVariantStock(
      links,
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
    )

    expect(result.get('var_1')).toBe(false)
  })

  test('a shortfall on the first item is not overwritten by a later one', ({ expect }) => {
    // Guards the fold's accumulator: the second iteration must AND with the first, not replace it.
    const links = [link('var_1', 'item_1'), link('var_1', 'item_2')]

    const result = buildVariantStock(
      links,
      new Map([
        ['item_1', 0],
        ['item_2', 5],
      ]),
    )

    expect(result.get('var_1')).toBe(false)
  })

  test('an item with no known quantity counts as zero', ({ expect }) => {
    const result = buildVariantStock([link('var_1', 'item_1')], new Map())

    expect(result.get('var_1')).toBe(false)
  })

  test('a variant with no links is absent, leaving the decision to the caller', ({ expect }) => {
    const result = buildVariantStock([], new Map([['item_1', 5]]))

    expect(result.has('var_1')).toBe(false)
    expect(result.size).toBe(0)
  })

  test('variants are decided independently', ({ expect }) => {
    const links = [link('var_1', 'item_1'), link('var_2', 'item_2')]

    const result = buildVariantStock(
      links,
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
    )

    expect(result.get('var_1')).toBe(true)
    expect(result.get('var_2')).toBe(false)
  })
})
