import type { ProductGroupingRuleDTO } from '../../../core/types/product/common.js'

/**
 * Whether a product whose fields hold `fields` belongs under `rule`: every key's condition holds,
 * each by any one of its values. Metafield values match exactly; the brand, under `vendorKey`,
 * matches ignoring case, as the storefront's brand filter does.
 */
export function matchesGroupingRule(
  rule: ProductGroupingRuleDTO,
  fields: ReadonlyMap<string, ReadonlySet<string>>,
  vendorKey?: string,
): boolean {
  return Object.entries(rule).every(([key, values]) => {
    const held = fields.get(key)
    if (!held) return false
    if (key !== vendorKey) return values.some((value) => held.has(value))
    const lowered = new Set([...held].map((value) => value.toLowerCase()))
    return values.some((value) => lowered.has(value.toLowerCase()))
  })
}
