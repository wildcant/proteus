import type { ProductGroupingRuleDTO } from '../../../core/types/product/common.js'

/**
 * Whether a product whose metafields hold `metafields` belongs under `rule`: every key's condition
 * holds, each by any one of its values.
 */
export function matchesGroupingRule(
  rule: ProductGroupingRuleDTO,
  metafields: ReadonlyMap<string, ReadonlySet<string>>,
): boolean {
  return Object.entries(rule).every(([key, values]) => values.some((value) => metafields.get(key)?.has(value)))
}
