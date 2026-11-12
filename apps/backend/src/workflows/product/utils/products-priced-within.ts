import type { CalculatedPriceSetDTO } from '@core/types/pricing/common.js'

type PriceRange = { minPrice?: number; maxPrice?: number }

/**
 * The products with a variant this market prices inside the range, either end optional. A product is
 * in when any one variant is: a pair of sneakers sold at 300 000 in one size and 340 000 in another
 * is in both "up to 320 000" and "from 320 000". Only priced variants count, so every id returned is
 * one the market can sell.
 */
export function productsPricedWithin(
  variants: { id: string; productId: string }[],
  priceByVariantId: Map<string, CalculatedPriceSetDTO>,
  { minPrice, maxPrice }: PriceRange,
): string[] {
  const productIds = new Set<string>()
  for (const variant of variants) {
    const amount = priceByVariantId.get(variant.id)?.calculatedAmount
    if (!amount) continue
    if (minPrice !== undefined && amount.isLessThan(minPrice)) continue
    if (maxPrice !== undefined && amount.isGreaterThan(maxPrice)) continue
    productIds.add(variant.productId)
  }
  return [...productIds]
}
