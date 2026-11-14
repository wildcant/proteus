import type { BigNumber } from '@core/bignumber.js'
import type { CalculatedPriceSetDTO } from '@core/types/pricing/common.js'
import type { ProductCategoryDTO, ProductFilterDTO, VariantOptionLabelDTO } from '@core/types/product/common.js'
import { OPTION_FILTER_PREFIX } from '@core/utils/product-filter-key.js'
import { buildFieldValueLabel, findNamingCategory } from './build-field-value-label.js'

type StoreProductFilter = Omit<ProductFilterDTO, 'values'> & {
  values: Array<{ value: string; label: string; count: number; soldOut: boolean; swatch: string | null }>
}

type StoreProductFilterShape = {
  /** The fields whose values are named by Categories: every field but the vendor's, whose values are brands. */
  namedFieldKeys: Set<string>
  /** Where a field value's label is found. */
  categories: ProductCategoryDTO[]
  /** The filter whose values carry a swatch key, the store's colour filter. */
  colorFilterKey: string
}

/**
 * The filters as the storefront draws them. An option's value is sold out when no variant carrying
 * it can be bought — `inStockLabels` are the option values of the variants in view that can. A field
 * value reads as the Category that names it, in that Category's place; a brand's or an option's
 * reads as itself, in the order the filter came in.
 */
export function buildStoreProductFilters(
  filters: ProductFilterDTO[],
  inStockLabels: VariantOptionLabelDTO[],
  { namedFieldKeys, categories, colorFilterKey }: StoreProductFilterShape,
): StoreProductFilter[] {
  const inStock = new Set(inStockLabels.map((label) => `${OPTION_FILTER_PREFIX}${label.optionTitle}:${label.value}`))
  return filters.map((filter) => {
    const isNamed = namedFieldKeys.has(filter.key)
    const values = isNamed ? inMenuOrder(filter.key, filter.values, categories) : filter.values
    return {
      ...filter,
      values: values.map((value) => ({
        ...value,
        label: isNamed ? buildFieldValueLabel(filter.key, value.value, categories) : value.value,
        soldOut: filter.key.startsWith(OPTION_FILTER_PREFIX) && !inStock.has(`${filter.key}:${value.value}`),
        swatch: filter.key === colorFilterKey ? swatchKey(value.value) : null,
      })),
    }
  })
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
 * "Café" → `cafe`, "Navy Blue" → `navy-blue`: lower-cased, accents dropped, words joined by hyphens. A
 * pure function of the value, so the key stays put however the counts or the catalogue move.
 */
function swatchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** The cheapest and dearest price over `variants`, for the price slider; `null` when none is priced. */
export function buildPriceBounds(
  variants: { id: string }[],
  priceByVariantId: Map<string, CalculatedPriceSetDTO>,
): { min: BigNumber; max: BigNumber } | null {
  const amounts = variants.flatMap((variant) => {
    const amount = priceByVariantId.get(variant.id)?.calculatedAmount
    return amount ? [amount] : []
  })
  const [first] = amounts
  if (!first) return null
  return amounts.reduce(
    (bounds, amount) => ({
      min: amount.isLessThan(bounds.min) ? amount : bounds.min,
      max: amount.isGreaterThan(bounds.max) ? amount : bounds.max,
    }),
    { min: first, max: first },
  )
}
