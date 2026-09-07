import { describe, expect, test } from 'vitest'
import type { AdminProductOption } from '#/api/generated/model'
import { enumerateVariantRows, fromVariantGridRows, resolveVariantsPayload, toVariantGridRows } from './variant-rows'

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

/** The two markets ILLO-47 shipped: the United States in dollars, Colombia in pesos. */
const STORE_CURRENCIES = ['usd', 'cop']

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
    const narrow = enumerateVariantRows(
      ALL,
      [
        { optionId: 'opt_size', valueIds: ['v_s'] },
        { optionId: 'opt_color', valueIds: ['v_wht'] },
      ],
      [],
      STORE_CURRENCIES,
    )
    const edited = narrow.map((row) => ({ ...row, sku: 'TEE-S-WHT', prices: { usd: '28.00', cop: '112000' } }))

    const widened = enumerateVariantRows(ALL, selectAll, edited, STORE_CURRENCIES)

    const carried = widened.find((row) => row.label === 'S / White')
    expect(carried?.sku).toBe('TEE-S-WHT')
    expect(carried?.prices).toEqual({ usd: '28.00', cop: '112000' })
    expect(widened.filter((row) => row.sku !== '')).toHaveLength(1)
  })

  test('every row is seeded with a price cell per store currency', () => {
    // The grid draws one column per store currency; a row missing that currency's key would show a
    // blank cell that never reaches the payload. This is what lets a product be created priced for
    // Colombia as well as the United States.
    const rows = enumerateVariantRows(ALL, selectAll, [], STORE_CURRENCIES)

    expect(rows).toHaveLength(4)
    for (const row of rows) {
      expect(Object.keys(row.prices)).toEqual(['usd', 'cop'])
      expect(row.prices).toEqual({ usd: '', cop: '' })
    }
  })

  test('an amount typed in a currency the store has since dropped is dropped with it', () => {
    // Carrying it would submit a price in money the store no longer sells in, in a currency the
    // merchant can no longer see or correct.
    const priced = enumerateVariantRows(ALL, selectAll, [], ['usd', 'eur']).map((row) => ({
      ...row,
      prices: { usd: '28.00', eur: '25.00' },
    }))

    const rows = enumerateVariantRows(ALL, selectAll, priced, STORE_CURRENCIES)

    expect(rows[0]?.prices).toEqual({ usd: '28.00', cop: '' })
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
    const rows = enumerateVariantRows(
      ALL,
      [
        { optionId: 'opt_size', valueIds: ['v_s'] },
        { optionId: 'opt_color', valueIds: ['v_wht'] },
      ],
      [],
      STORE_CURRENCIES,
    )

    const payload = resolveVariantsPayload({ hasVariants: true, options: selectAll, rows })

    expect(payload.variants?.[0]).not.toHaveProperty('sku')
    expect(payload.variants?.[0]).not.toHaveProperty('prices')
  })

  test('a variant priced in two currencies is sent with both', () => {
    const rows = enumerateVariantRows(ALL, selectAll, [], STORE_CURRENCIES).map((row) => ({
      ...row,
      prices: { usd: '28.00', cop: '112000' },
    }))

    const payload = resolveVariantsPayload({ hasVariants: true, options: selectAll, rows })

    expect(payload.variants?.[0]?.prices).toEqual([
      { currencyCode: 'usd', amount: '28.00' },
      { currencyCode: 'cop', amount: '112000' },
    ])
  })

  test('a currency left blank is skipped, and the ones that were filled in still go', () => {
    // A price in every currency is not required — otherwise no product could be saved until every
    // market it will ever sell in has been priced.
    const rows = enumerateVariantRows(ALL, selectAll, [], STORE_CURRENCIES).map((row) => ({
      ...row,
      prices: { usd: '28.00', cop: '' },
    }))

    const payload = resolveVariantsPayload({ hasVariants: true, options: selectAll, rows })

    expect(payload.variants?.[0]?.prices).toEqual([{ currencyCode: 'usd', amount: '28.00' }])
  })
})

describe('the grid projection', () => {
  test('flattens each currency into its own column key', () => {
    // `DataGridColumn` reaches a value by a single key, so a nested `prices` would be unreachable
    // and every price cell would render blank.
    const rows = enumerateVariantRows(ALL, selectAll, [], STORE_CURRENCIES)

    expect(toVariantGridRows(rows)[0]).toEqual({ label: 'S / White', sku: '', usd: '', cop: '' })
  })

  test('folds an edited cell back onto the row it came from, leaving the rest alone', () => {
    const rows = enumerateVariantRows(ALL, selectAll, [], STORE_CURRENCIES)
    const gridRows = toVariantGridRows(rows)
    const edited = gridRows.map((gridRow, index) => (index === 1 ? { ...gridRow, cop: '112000' } : gridRow))

    const folded = fromVariantGridRows(rows, edited)

    expect(folded[1]?.prices).toEqual({ usd: '', cop: '112000' })
    expect(folded[1]?.key).toBe(rows[1]?.key)
    expect(folded[1]?.optionValues).toEqual(rows[1]?.optionValues)
    expect(folded[0]?.prices).toEqual({ usd: '', cop: '' })
  })
})
