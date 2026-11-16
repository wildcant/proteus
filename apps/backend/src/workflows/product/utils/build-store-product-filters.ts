import type { ProductCategoryDTO, ProductFilterDTO } from '@core/types/product/common.js'
import { OPTION_FILTER_PREFIX, SALE_FILTER_KEY, SALE_FILTER_VALUE } from '@core/utils/product-filter-key.js'
import { i18n } from '@proteus/utils'
import { buildFieldValueLabel, findNamingCategory } from './build-field-value-label.js'

type StoreProductFilter = Omit<ProductFilterDTO, 'values'> & {
  values: Array<{ value: string; label: string; count: number; soldOut: boolean; swatch: string | null }>
}

type StoreProductFilterShape = {
  /** The fields whose values are named by Categories: every field but the vendor's, whose values are brands. */
  namedFieldKeys: Set<string>
  /** Where a field value's label is found. */
  categories: ProductCategoryDTO[]
}

/**
 * The filters as the storefront draws them. An option's value is sold out when no variant carrying
 * it can be bought — `inStockLabels` are the option values some purchasable variant in view carries. A field
 * value reads as the Category that names it, in that Category's place; a brand's or an option's
 * reads as itself, in the order the filter came in.
 */
export function buildStoreProductFilters(
  filters: ProductFilterDTO[],
  inStockLabels: Array<{ optionTitle: string; value: string }>,
  { namedFieldKeys, categories }: StoreProductFilterShape,
): StoreProductFilter[] {
  const inStock = new Set(inStockLabels.map((label) => `${OPTION_FILTER_PREFIX}${label.optionTitle}:${label.value}`))
  return filters.map((filter) => {
    if (filter.key === SALE_FILTER_KEY) {
      return {
        ...filter,
        values: filter.values.map((value) => ({ ...value, label: i18n.t('On sale'), soldOut: false, swatch: null })),
      }
    }
    const isNamed = namedFieldKeys.has(filter.key)
    const values = isNamed ? inMenuOrder(filter.key, filter.values, categories) : filter.values
    return {
      ...filter,
      values: values.map((value) => ({
        ...value,
        label: isNamed ? buildFieldValueLabel(filter.key, value.value, categories) : value.value,
        soldOut: filter.key.startsWith(OPTION_FILTER_PREFIX) && !inStock.has(`${filter.key}:${value.value}`),
        // An option value's swatch is its bucket's; a field value has none.
        swatch: value.swatch ?? null,
      })),
    }
  })
}

/**
 * The built-in sale filter, «Sale» with its one value «On sale», holding `count` products. Named in
 * Proteus's catalogs rather than the structure file, since its key names no field.
 */
export function buildSaleFilter(count: number): ProductFilterDTO {
  return { key: SALE_FILTER_KEY, name: i18n.t('Sale'), values: [{ value: SALE_FILTER_VALUE, count }] }
}

/**
 * A field's values in the order the menu ranks the Categories that name them, so the filter reads
 * like the menu. A value no Category names keeps its place after them.
 */
function inMenuOrder<T extends { value: string }>(key: string, values: T[], categories: ProductCategoryDTO[]): T[] {
  const rankOf = (value: string) => findNamingCategory(key, value, categories)?.rank ?? Number.POSITIVE_INFINITY
  return [...values].sort((a, b) => rankOf(a.value) - rankOf(b.value))
}

/**
 * The filters the storefront shows: with `order`, the structure file's `filters`, exactly those keys
 * in that order; without, every filter as it came.
 */
export function orderStoreFilters(filters: ProductFilterDTO[], order: string[] | null): ProductFilterDTO[] {
  if (!order) return filters
  return order.flatMap((key) => filters.filter((filter) => filter.key === key))
}
