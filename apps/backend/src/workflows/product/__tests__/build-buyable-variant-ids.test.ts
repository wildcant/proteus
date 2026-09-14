import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { test } from '@tests/setup/test-extend.js'
import type { VariantStockFlags } from '../../cart/utils/variant-inventory.js'
import { buildBuyableVariantIds } from '../utils/build-buyable-variant-ids.js'

const link = (variantId: string, inventoryItemId: string, requiredQuantity = 1): ProductVariantInventoryItemDTO => ({
  id: `pvitem_${variantId}_${inventoryItemId}`,
  variantId,
  inventoryItemId,
  requiredQuantity,
  createdAt: new Date(),
  deletedAt: null,
})

/** The defaults the column carries: tracked, no backorder. */
const variant = (id: string, flags: Partial<VariantStockFlags> = {}): VariantStockFlags => ({
  id,
  manageInventory: true,
  allowBackorder: false,
  ...flags,
})

test.describe('buildBuyableVariantIds', () => {
  test('a variant is buyable when its item covers the required quantity', ({ expect }) => {
    const result = buildBuyableVariantIds([variant('var_1')], [link('var_1', 'item_1', 2)], new Map([['item_1', 2]]))

    expect(result.has('var_1')).toBe(true)
  })

  test('a variant is not buyable when its item falls short', ({ expect }) => {
    const result = buildBuyableVariantIds([variant('var_1')], [link('var_1', 'item_1', 3)], new Map([['item_1', 2]]))

    expect(result.has('var_1')).toBe(false)
  })

  test('every item must be covered, not just one', ({ expect }) => {
    // The rule this function exists for: a variant needing several items is only buyable when
    // all of them are covered. An `Array.some` would wrongly report this one as buyable.
    const links = [link('var_1', 'item_1'), link('var_1', 'item_2')]

    const result = buildBuyableVariantIds(
      [variant('var_1')],
      links,
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
    )

    expect(result.has('var_1')).toBe(false)
  })

  test('an item with no known quantity counts as zero', ({ expect }) => {
    const result = buildBuyableVariantIds([variant('var_1')], [link('var_1', 'item_1')], new Map())

    expect(result.has('var_1')).toBe(false)
  })

  test('an untracked variant is buyable whatever its quantities say', ({ expect }) => {
    // Stocked at nothing and still on sale: a made-to-order item is never sold out, which is the
    // whole point of the flag. The link and the level are there to prove the numbers are ignored
    // rather than missing.
    const result = buildBuyableVariantIds(
      [variant('var_1', { manageInventory: false })],
      [link('var_1', 'item_1')],
      new Map([['item_1', 0]]),
    )

    expect(result.has('var_1')).toBe(true)
  })

  test('a backorder variant is buyable past what is on the shelf', ({ expect }) => {
    const result = buildBuyableVariantIds(
      [variant('var_1', { allowBackorder: true })],
      [link('var_1', 'item_1')],
      new Map([['item_1', 0]]),
    )

    expect(result.has('var_1')).toBe(true)
  })

  test('a tracked variant with no inventory item is not buyable', ({ expect }) => {
    // The arrangement checkout refuses as invalid data. Offering it here would be the storefront
    // promising what the cart then declines — and it is how an admin-created variant used to
    // oversell without limit.
    const result = buildBuyableVariantIds([variant('var_1')], [], new Map([['item_1', 5]]))

    expect(result.has('var_1')).toBe(false)
  })

  test('variants are decided independently', ({ expect }) => {
    const links = [link('var_1', 'item_1'), link('var_2', 'item_2')]

    const result = buildBuyableVariantIds(
      [variant('var_1'), variant('var_2')],
      links,
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
    )

    expect(result.has('var_1')).toBe(true)
    expect(result.has('var_2')).toBe(false)
  })
})
