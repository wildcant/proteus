import type { ProductGroupingRuleDTO } from '../../../core/types/product/common.js'

/** Whether a product carrying `tagValues` belongs under `rule`: every condition holds, each by any one of its values. */
export function matchesGroupingRule(rule: ProductGroupingRuleDTO, tagValues: ReadonlySet<string>): boolean {
  return rule.every((condition) => condition.some((value) => tagValues.has(value)))
}
