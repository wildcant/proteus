import type { ProductCategoryDTO } from '@core/types/product/common.js'

/**
 * A field value as the menu names it: the name of the Category whose rule selects exactly that value
 * of that field (`{ style: [classics] }` is "Classics"). A value no Category names shows as written,
 * capitalised (`men` is "Men").
 */
export function buildFieldValueLabel(key: string, value: string, categories: ProductCategoryDTO[]): string {
  return findNamingCategory(key, value, categories)?.name ?? value.charAt(0).toUpperCase() + value.slice(1)
}

/** The Category whose rule selects exactly `value` of `key`, the one that names it. */
export function findNamingCategory(
  key: string,
  value: string,
  categories: ProductCategoryDTO[],
): ProductCategoryDTO | undefined {
  return categories.find(({ rule }) => {
    if (!rule) return false
    const keys = Object.keys(rule)
    return keys.length === 1 && keys[0] === key && rule[key]?.length === 1 && rule[key][0] === value
  })
}
