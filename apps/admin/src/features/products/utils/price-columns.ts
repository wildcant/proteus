import type { DataGridColumn } from '#/components/data-grid'

/**
 * A grid row holding one amount per currency, keyed by ISO 4217 code.
 *
 * `DataGridColumn` reaches a value by a single key, so a row editable in several currencies carries
 * one key per code at its top level rather than nesting them under a `prices` object. A code is
 * three letters, so it cannot collide with a row's other columns.
 */
export type CurrencyAmounts = Record<string, string>

/** `Price USD`, `Price COP` — the currency named in the header, since the cell shows only a symbol. */
export function priceColumnHeader(currencyCode: string): string {
  return `Price ${currencyCode.toUpperCase()}`
}

/**
 * One editable column per store currency.
 *
 * Built from the currency list rather than written out, which is what lets a merchant price a
 * variant in every market the store sells to instead of only the one the form was written for.
 */
export function buildPriceColumns(currencyCodes: string[]): DataGridColumn<CurrencyAmounts>[] {
  return currencyCodes.map((currencyCode) => ({
    header: priceColumnHeader(currencyCode),
    accessorKey: currencyCode,
    type: 'currency',
    currencyCode,
  }))
}
