import { test } from '@tests/setup/test-extend.js'
import { buildVariantInventoryItems, type VariantInventorySeed } from '../utils/build-variant-inventory-items.js'

const variant = (overrides: Partial<VariantInventorySeed> = {}): VariantInventorySeed => ({
  title: 'Small / Green',
  sku: 'TSHIRT-S-GREEN',
  originCountry: 'co',
  hsCode: '6109',
  midCode: 'mid',
  material: 'cotton',
  weight: 180,
  length: 30,
  height: 2,
  width: 20,
  ...overrides,
})

test.describe('buildVariantInventoryItems', () => {
  test('carries every field the Inventory Item shares with the variant', ({ expect }) => {
    const [item] = buildVariantInventoryItems([variant()])

    expect(item).toEqual({
      sku: 'TSHIRT-S-GREEN',
      title: 'Small / Green',
      // Medusa puts the variant's title here too; there is no variant description to take.
      description: 'Small / Green',
      originCountry: 'co',
      hsCode: '6109',
      midCode: 'mid',
      material: 'cotton',
      weight: 180,
      length: 30,
      height: 2,
      width: 20,
      requiresShipping: true,
    })
  })

  test('rounds the dimensions the variant holds as fractions', ({ expect }) => {
    // A variant's four dimensions are `double precision` and an Inventory Item's are `integer`.
    const [item] = buildVariantInventoryItems([variant({ weight: 180.6, length: 30.4, height: 0.5, width: 19.5 })])

    expect(item).toMatchObject({ weight: 181, length: 30, height: 1, width: 20 })
  })

  test('leaves a dimension the variant does not carry unset rather than zero', ({ expect }) => {
    // Zero is a measurement; absent is not. An item weighing 0kg would be a claim nobody made.
    const [item] = buildVariantInventoryItems([variant({ weight: null, sku: null, material: null })])

    expect(item).toMatchObject({ weight: null, sku: null, material: null })
  })

  test('maps every variant it is given, in order', ({ expect }) => {
    // The caller pairs each created item back to its variant by position, so a map that dropped
    // or reordered one would link the wrong item to the wrong variant.
    const items = buildVariantInventoryItems([variant({ sku: 'A' }), variant({ sku: 'B' }), variant({ sku: 'C' })])

    expect(items.map((item) => item.sku)).toEqual(['A', 'B', 'C'])
  })
})
