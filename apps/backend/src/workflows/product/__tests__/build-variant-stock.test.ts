import type { ProductVariantInventoryItemDTO } from '@core/types/link/common.js'
import { test } from '@tests/setup/test-extend.js'
import type { VariantStockFlags } from '../../cart/utils/variant-inventory.js'
import { isPurchasable, variantStockProjection } from '../utils/build-variant-stock.js'

const link = (variantId: string, inventoryItemId: string, requiredQuantity = 1): ProductVariantInventoryItemDTO => ({
  id: `pvitem_${variantId}_${inventoryItemId}`,
  variantId,
  inventoryItemId,
  requiredQuantity,
  createdAt: new Date(),
  deletedAt: null,
})

/** The defaults the columns carry: tracked, no backorder. */
const variant = (id: string, flags: Partial<VariantStockFlags> = {}): VariantStockFlags => ({
  id,
  manageInventory: true,
  allowBackorder: false,
  ...flags,
})

test.describe('variantStockProjection', () => {
  test('the threshold is a floor, not a fence: at it is low, one above it is not', ({ expect }) => {
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 3]]), 3)
    const above = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 4]]), 3)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'low', remaining: 3 })
    expect(above(variant('var_1'))).toEqual({ state: 'available' })
  })

  test('sold out wins over low at zero, however high the threshold', ({ expect }) => {
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 0]]), 10)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'soldOut' })
  })

  test('a null threshold turns the low state off rather than down', ({ expect }) => {
    // One setting silences both audiences: no alert for the shopkeeper, no "only N left" for the
    // shopper. Everything still in stock reads as plainly available.
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 1]]), null)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'available' })
  })

  test('remaining counts units of the variant, not units of its scarcest item', ({ expect }) => {
    // A variant consuming two of something has half as many of itself left. Reporting the item's
    // four would tell a shopper they can buy twice what the cart would accept.
    const stockOf = variantStockProjection([link('var_1', 'item_1', 2)], new Map([['item_1', 4]]), 5)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'low', remaining: 2 })
  })

  test('a variant needing more of an item than is left is sold out, not fractionally low', ({ expect }) => {
    // Three per unit against two on the shelf buys nothing. Dividing without flooring would call
    // this `low` with a `remaining` of 0.667 — a fraction of a unit, on the wire, for copy that
    // says "only N left".
    const stockOf = variantStockProjection([link('var_1', 'item_1', 3)], new Map([['item_1', 2]]), 5)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'soldOut' })
  })

  test('a variant is sold out once any one of its items runs short', ({ expect }) => {
    // The rule this projection exists for: several items, and the scarcest decides. Taking the
    // largest — or the first — would offer a variant the cart cannot assemble.
    const stockOf = variantStockProjection(
      [link('var_1', 'item_1'), link('var_1', 'item_2')],
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
      null,
    )

    expect(stockOf(variant('var_1'))).toEqual({ state: 'soldOut' })
  })

  test('an item with no known quantity counts as zero', ({ expect }) => {
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map(), 5)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'soldOut' })
  })

  test('an untracked variant is available whatever its quantities say', ({ expect }) => {
    // Stocked at nothing and still on sale: a made-to-order item is never sold out and never low,
    // which is the whole point of the flag. The link and the quantity are there to prove the
    // numbers are ignored rather than missing.
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 0]]), 5)

    expect(stockOf(variant('var_1', { manageInventory: false }))).toEqual({ state: 'available' })
  })

  test('a backorder variant is available past what is on the shelf, and never low', ({ expect }) => {
    // Backorder is honoured by the backend and renders as plain available — a distinct shopper-
    // facing backorder state is deliberately deferred. A `low` here would be a countdown on
    // something the shop is happy to keep selling.
    const stockOf = variantStockProjection([link('var_1', 'item_1')], new Map([['item_1', 1]]), 5)

    expect(stockOf(variant('var_1', { allowBackorder: true }))).toEqual({ state: 'available' })
  })

  test('a tracked variant with no inventory item is sold out', ({ expect }) => {
    // The arrangement checkout refuses as invalid data. Offering it here would be the storefront
    // promising what the cart then declines — and it is how an admin-created variant used to
    // oversell without limit.
    const stockOf = variantStockProjection([], new Map([['item_1', 5]]), 5)

    expect(stockOf(variant('var_1'))).toEqual({ state: 'soldOut' })
  })

  test('variants are decided independently', ({ expect }) => {
    const stockOf = variantStockProjection(
      [link('var_1', 'item_1'), link('var_2', 'item_2')],
      new Map([
        ['item_1', 5],
        ['item_2', 0],
      ]),
      2,
    )

    expect(stockOf(variant('var_1'))).toEqual({ state: 'available' })
    expect(stockOf(variant('var_2'))).toEqual({ state: 'soldOut' })
  })
})

test.describe('isPurchasable', () => {
  test('only sold out stops a shopper buying — low is still on sale', ({ expect }) => {
    expect(isPurchasable({ state: 'available' })).toBe(true)
    expect(isPurchasable({ state: 'low', remaining: 1 })).toBe(true)
    expect(isPurchasable({ state: 'soldOut' })).toBe(false)
  })
})
