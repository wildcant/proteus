import type { ProductVariantPriceSetDTO } from '@core/types/link/common.js'
import type { CalculatedPriceSetDTO } from '@core/types/pricing/common.js'

/**
 * Maps each variant to its calculated price for the product detail page.
 *
 * Unlike {@link buildStartingPrices} which picks the cheapest across variants,
 * this returns every variant's price so the detail page can show per-variant pricing.
 */
export function buildVariantPrices(
  links: ProductVariantPriceSetDTO[],
  calculatedPrices: CalculatedPriceSetDTO[],
): Map<string, CalculatedPriceSetDTO> {
  const variantToPriceSetId = new Map(links.map((link) => [link.variantId, link.priceSetId]))
  const calculatedPriceBySetId = new Map(calculatedPrices.map((price) => [price.id, price]))

  const result = new Map<string, CalculatedPriceSetDTO>()

  for (const [variantId, priceSetId] of variantToPriceSetId) {
    const calculated = calculatedPriceBySetId.get(priceSetId)
    if (!calculated) continue

    result.set(variantId, calculated)
  }

  return result
}
