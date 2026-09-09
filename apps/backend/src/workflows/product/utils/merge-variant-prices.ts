import type { BigNumber } from '@core/bignumber.js'

type PriceEntry = { id?: string | undefined; currencyCode: string; amount: BigNumber }

/** What the pricing module takes for one price set: a full list, one entry per currency. */
type UpsertPriceEntry = { id?: string; currencyCode: string; amount: BigNumber }

/**
 * Folds an edit into the prices a variant already has.
 *
 * `upsertPriceSets` reads its `prices` as the price set's whole contents — anything missing from
 * the list is deleted. An admin editing one currency sends only that currency, so passing the
 * payload through would silently destroy every other one. Carrying the untouched currencies along
 * is what makes the write a merge rather than a replace.
 *
 * Matching is by currency code, because that is what identifies a price within a set: an incoming
 * price with no id still overwrites the row already quoting that currency instead of adding a
 * second one beside it.
 */
export function mergeVariantPrices(existing: PriceEntry[], incoming: PriceEntry[]): UpsertPriceEntry[] {
  const key = (currencyCode: string) => currencyCode.trim().toLowerCase()
  const existingByCurrency = new Map(existing.map((price) => [key(price.currencyCode), price]))

  const merged = incoming.map((price) => {
    const id = price.id ?? existingByCurrency.get(key(price.currencyCode))?.id
    return { ...(id ? { id } : {}), currencyCode: price.currencyCode, amount: price.amount }
  })

  const edited = new Set(incoming.map((price) => key(price.currencyCode)))
  const untouched = existing
    .filter((price) => !edited.has(key(price.currencyCode)))
    .map((price) => ({ ...(price.id ? { id: price.id } : {}), currencyCode: price.currencyCode, amount: price.amount }))

  return [...merged, ...untouched]
}
