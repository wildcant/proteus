import { describe, expect, test } from 'vitest'
import { buildPriceColumns, priceColumnHeader } from './price-columns'

describe('buildPriceColumns', () => {
  test('two configured currencies produce two editable price columns', () => {
    // The regression that put Colombia in this state: the editor offered one hardcoded `usd`
    // column, so a product created in the admin could never be priced in pesos and the storefront
    // — which refuses to show a product it cannot price — hid it on /es-CO.
    const columns = buildPriceColumns(['usd', 'cop'])

    expect(columns).toEqual([
      { header: 'Price USD', accessorKey: 'usd', type: 'currency', currencyCode: 'usd' },
      { header: 'Price COP', accessorKey: 'cop', type: 'currency', currencyCode: 'cop' },
    ])
  })

  test('columns follow the order the store gives its currencies in', () => {
    expect(buildPriceColumns(['cop', 'usd']).map((column) => column.accessorKey)).toEqual(['cop', 'usd'])
  })

  test('a store selling in one currency still offers exactly one column', () => {
    expect(buildPriceColumns(['usd'])).toHaveLength(1)
  })

  test('no currencies configured is no columns, not a fallback to dollars', () => {
    // Quoting a currency the store never chose is how a price ends up in money no region settles in.
    expect(buildPriceColumns([])).toEqual([])
  })
})

describe('priceColumnHeader', () => {
  test('names the currency, since the cell itself shows only a symbol', () => {
    expect(priceColumnHeader('cop')).toBe('Price COP')
  })
})
