import type { I18n } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import type { AdminUpdateVariantPricesPricesItem } from '#/api/generated/model'
import type { DataGridColumn } from '#/components/data-grid/types'

/**
 * A grid row holding a price and a compare-at amount per currency: the price under the ISO 4217
 * code, the compare-at under `compareAt:<code>`.
 *
 * `DataGridColumn` reaches a value by a single key, so a row editable in several currencies carries
 * its amounts at its top level rather than nesting them under a `prices` object. A code is three
 * letters and the compare-at key has a colon, so neither can collide with a row's other columns.
 */
export type CurrencyAmounts = Record<string, string>

const COMPARE_AT_PREFIX = 'compareAt:'

/** The row key holding a currency's compare-at amount. */
export function compareAtKey(currencyCode: string): string {
  return `${COMPARE_AT_PREFIX}${currencyCode}`
}

/**
 * Two editable columns per store currency, its price then its compare-at, so the pair a shopper
 * sees side by side is typed side by side.
 *
 * Built from the currency list rather than written out, which is what lets a merchant price a
 * variant in every market the store sells to instead of only the one the form was written for.
 * The header names the currency, since the cell shows only a symbol.
 */
export function buildPriceColumns(currencyCodes: string[], i18n: I18n): DataGridColumn<CurrencyAmounts>[] {
  return currencyCodes.flatMap((currencyCode): DataGridColumn<CurrencyAmounts>[] => {
    const code = currencyCode.toUpperCase()
    return [
      { header: i18n._(msg`Price ${code}`), accessorKey: currencyCode, type: 'currency', currencyCode },
      {
        header: i18n._(msg`Compare-at ${code}`),
        accessorKey: compareAtKey(currencyCode),
        type: 'currency',
        currencyCode,
      },
    ]
  })
}

/**
 * The price edit as a payload, or `undefined` when nothing changed.
 *
 * A currency whose price is blank is omitted rather than sent as zero: the endpoint merges by
 * currency, so omitting one leaves whatever it already has alone, and quoting zero would put a
 * variant on sale for nothing. A compare-at without a price is dropped with it. Every currency that
 * is sent carries its compare-at, blank as `null`, because the endpoint takes a sent entry as the
 * whole price for its currency and clears a compare-at left out. That is also why a price the
 * merchant never touched is safe to send — it goes back with the same id and amounts it arrived with.
 */
export function buildPricePayload(
  currencyCodes: string[],
  initial: CurrencyAmounts,
  current: CurrencyAmounts,
  priceIdByCurrency: Map<string, string>,
): AdminUpdateVariantPricesPricesItem[] | undefined {
  const prices: AdminUpdateVariantPricesPricesItem[] = []
  let hasChanges = false

  for (const currencyCode of currencyCodes) {
    const amount = current[currencyCode] ?? ''
    const compareAtAmount = current[compareAtKey(currencyCode)] ?? ''
    if (amount !== (initial[currencyCode] ?? '') || compareAtAmount !== (initial[compareAtKey(currencyCode)] ?? '')) {
      hasChanges = true
    }
    if (amount === '') continue

    const id = priceIdByCurrency.get(currencyCode)
    prices.push({
      ...(id ? { id } : {}),
      currencyCode,
      amount,
      compareAtAmount: compareAtAmount === '' ? null : compareAtAmount,
    })
  }

  return hasChanges && prices.length > 0 ? prices : undefined
}
