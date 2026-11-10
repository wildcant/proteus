import type { FilterableProductProps } from '@core/types/product/common.js'

type StoreGroupingParams = {
  category?: string
  collection?: string
  tag?: string | string[]
}

/**
 * The store's grouping params as product filters. Mapped by hand rather than spread: `category`,
 * `collection` and `tag` are no columns, so a spread would reach the query builder as keys it
 * silently drops. A store `category` lists its Visible descendants too, and a hidden one matches
 * nothing.
 */
export function buildStoreGroupingFilters({ category, collection, tag }: StoreGroupingParams): FilterableProductProps {
  return {
    ...(category === undefined ? {} : { categoryHandle: category, includeDescendants: true, visibleOnly: true }),
    ...(collection === undefined ? {} : { collectionHandle: collection }),
    ...(tag === undefined ? {} : { tagValue: tag }),
  }
}
