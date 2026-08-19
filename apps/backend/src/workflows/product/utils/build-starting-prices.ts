import type { ProductVariantPriceSetDTO } from '@core/types/link/common.js'
import type { CalculatedPriceSetDTO } from '@core/types/pricing/common.js'
import { buildVariantPrices } from './build-variant-prices.js'

/**
 * Derives the cheapest variant price per product for "from $X" display on the storefront grid.
 *
 * Builds on {@link buildVariantPrices} to resolve per-variant prices, then picks the
 * cheapest across each product's variants.
 */
export function buildStartingPrices(
  variants: { id: string; productId: string }[],
  links: ProductVariantPriceSetDTO[],
  calculatedPrices: CalculatedPriceSetDTO[],
): Map<string, CalculatedPriceSetDTO> {
  const priceByVariantId = buildVariantPrices(links, calculatedPrices)

  const startingPriceByProductId = new Map<string, CalculatedPriceSetDTO>()

  for (const variant of variants) {
    const calculated = priceByVariantId.get(variant.id)
    if (!calculated) continue

    /** Keep only the cheapest variant price per product */
    const existing = startingPriceByProductId.get(variant.productId)
    if (!existing || calculated.calculatedAmount.isLessThan(existing.calculatedAmount)) {
      startingPriceByProductId.set(variant.productId, calculated)
    }
  }

  return startingPriceByProductId
}
