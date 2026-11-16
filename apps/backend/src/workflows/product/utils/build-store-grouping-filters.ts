import type { FilterableProductProps } from '@core/types/product/common.js'
import { OPTION_FILTER_PREFIX, SALE_FILTER_KEY, SALE_FILTER_VALUE } from '@core/utils/product-filter-key.js'

type StoreGroupingParams = {
  category?: string
  collection?: string
  tag?: string | string[]
  filter?: string | string[]
}

/**
 * The store's grouping params as product filters. Mapped by hand rather than spread: `category`,
 * `collection`, `tag` and `filter` are no columns, so a spread would reach the query builder as keys
 * it silently drops. A store `category` lists its Visible descendants too, and a hidden one matches
 * nothing. The sale filter reads price, which no product filter can, so it is left to
 * {@link selectsSale} and the listing.
 */
export function buildStoreGroupingFilters({
  category,
  collection,
  tag,
  filter,
}: StoreGroupingParams): FilterableProductProps {
  return {
    ...(category === undefined ? {} : { categoryHandle: category, includeDescendants: true, visibleOnly: true }),
    ...(collection === undefined ? {} : { collectionHandle: collection }),
    ...(tag === undefined ? {} : { tagValue: tag }),
    ...(filter === undefined ? {} : splitSelections(groupSelectionsByKey(filter))),
  }
}

/** Whether the `filter` param holds `price.sale:on`, the built-in filter for products on sale. */
export function selectsSale(filter: string | string[] | undefined): boolean {
  if (filter === undefined) return false
  return (groupSelectionsByKey(filter)[SALE_FILTER_KEY] ?? []).includes(SALE_FILTER_VALUE)
}

/** The `option.<title>` keys are options, by title; every other key but the sale filter's is a metafield's. */
function splitSelections(
  selections: Record<string, string[]>,
): Pick<FilterableProductProps, 'metafields' | 'optionValues'> {
  const metafields: Record<string, string[]> = {}
  const optionValues: Record<string, string[]> = {}
  for (const [key, values] of Object.entries(selections)) {
    if (key === SALE_FILTER_KEY) continue
    if (key.startsWith(OPTION_FILTER_PREFIX)) optionValues[key.slice(OPTION_FILTER_PREFIX.length)] = values
    else metafields[key] = values
  }
  return { metafields, optionValues }
}

/** `['genero:women', 'tipo:tops', 'tipo:shoes']` → `{ genero: ['women'], tipo: ['tops', 'shoes'] }`. */
function groupSelectionsByKey(filter: string | string[]): Record<string, string[]> {
  const metafields: Record<string, string[]> = {}
  for (const selection of Array.isArray(filter) ? filter : [filter]) {
    // The schema guarantees a colon; the value keeps any later ones.
    const separator = selection.indexOf(':')
    const key = selection.slice(0, separator)
    metafields[key] = [...(metafields[key] ?? []), selection.slice(separator + 1)]
  }
  return metafields
}
