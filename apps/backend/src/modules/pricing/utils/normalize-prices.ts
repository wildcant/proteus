import type { BigNumber } from '@core/bignumber.js'
import type { CreatePriceDTO } from '@core/types/pricing/mutations.js'

export type NormalizedPrice = { currencyCode: string; amount: BigNumber; priceSetId: string }

// TODO(pricing): extend with priceListId, minQuantity, maxQuantity, and rules when those arrive.
function hashPrice(price: { currencyCode: string; priceSetId: string }): string {
  const parts: string[] = []
  parts.push(`cc:${price.currencyCode.toLowerCase()}`)
  parts.push(`ps:${price.priceSetId}`)
  return parts.sort().join('|')
}

export function normalizePrices(prices: CreatePriceDTO[], priceSetId: string): NormalizedPrice[] {
  const map = new Map<string, NormalizedPrice>()
  for (const price of prices) {
    const normalized: NormalizedPrice = {
      currencyCode: price.currencyCode.toLowerCase(),
      amount: price.amount,
      priceSetId,
    }
    map.set(hashPrice(normalized), normalized)
  }
  return Array.from(map.values())
}
