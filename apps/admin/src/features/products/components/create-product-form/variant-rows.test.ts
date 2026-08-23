import { describe, expect, test } from 'vitest'
import type { AdminProductOption } from '#/api/generated/model'
import { enumerateVariantRows, resolveVariantsPayload } from './variant-rows'

const option = (id: string, title: string, values: Array<[string, string]>): AdminProductOption =>
  ({
    id,
    title,
    values: values.map(([valueId, value]) => ({ id: valueId, value })),
  }) as AdminProductOption

const SIZE = option('opt_size', 'Size', [
  ['v_s', 'S'],
  ['v_m', 'M'],
])
const COLOR = option('opt_color', 'Color', [
  ['v_wht', 'White'],
  ['v_blk', 'Black'],
])
const ALL = [SIZE, COLOR]

const selectAll = [
  { optionId: 'opt_size', valueIds: ['v_s', 'v_m'] },
  { optionId: 'opt_color', valueIds: ['v_wht', 'v_blk'] },
]

describe('enumerateVariantRows', () => {
  test('produces the full matrix in the product option order', () => {
    expect(enumerateVariantRows(ALL, selectAll).map((row) => row.label)).toEqual([
      'S / White',
      'S / Black',
      'M / White',
      'M / Black',
    ])
  })

  test('an edited SKU survives adding a value elsewhere in the matrix', () => {
    // Medusa's wizard rebuilds the array and loses this. Rows are keyed by combination, not by
    // position, so a row that still exists keeps what was typed into it.
    const narrow = enumerateVariantRows(ALL, [
      { optionId: 'opt_size', valueIds: ['v_s'] },
      { optionId: 'opt_color', valueIds: ['v_wht'] },
    ])
    const edited = narrow.map((row) => ({ ...row, sku: 'TEE-S-WHT', price: '28.00' }))

    const widened = enumerateVariantRows(ALL, selectAll, edited)

    const carried = widened.find((row) => row.label === 'S / White')
    expect(carried?.sku).toBe('TEE-S-WHT')
    expect(carried?.price).toBe('28.00')
    expect(widened.filter((row) => row.sku !== '')).toHaveLength(1)
  })

  test('an option offering no values is not a dimension', () => {
    // Left in, it would multiply the matrix to nothing and the grid would go blank.
    const rows = enumerateVariantRows(ALL, [
      { optionId: 'opt_size', valueIds: ['v_s', 'v_m'] },
      { optionId: 'opt_color', valueIds: [] },
    ])

    expect(rows.map((row) => row.label)).toEqual(['S', 'M'])
  })

  test('no options at all produces no rows', () => {
    expect(enumerateVariantRows(ALL, [])).toEqual([])
  })
})

describe('resolveVariantsPayload', () => {
  test('a product without variations still gets one variant', () => {
    // A product with no variants cannot be added to a cart; the server titles this one after it.
    expect(resolveVariantsPayload({ hasVariants: false, options: selectAll, rows: [] })).toEqual({
      variants: [{ optionValues: {} }],
    })
  })

  test('rank follows the sortable list order', () => {
    const rows = enumerateVariantRows(ALL, selectAll)
    const reordered = [...rows].reverse()

    const payload = resolveVariantsPayload({ hasVariants: true, options: selectAll, rows: reordered })

    expect(payload.variants?.map((variant) => variant.variantRank)).toEqual([0, 1, 2, 3])
    expect(payload.variants?.[0]?.optionValues).toEqual(reordered[0]?.optionValues)
  })

  test('an empty SKU or price is omitted rather than sent blank', () => {
    const rows = enumerateVariantRows(ALL, [
      { optionId: 'opt_size', valueIds: ['v_s'] },
      { optionId: 'opt_color', valueIds: ['v_wht'] },
    ])

    const payload = resolveVariantsPayload({ hasVariants: true, options: selectAll, rows })

    expect(payload.variants?.[0]).not.toHaveProperty('sku')
    expect(payload.variants?.[0]).not.toHaveProperty('prices')
  })
})
