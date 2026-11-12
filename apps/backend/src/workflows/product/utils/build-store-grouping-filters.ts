import type { FilterableProductProps } from '@core/types/product/common.js'

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
 * nothing.
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
    ...(filter === undefined ? {} : { metafields: groupSelectionsByKey(filter) }),
  }
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
