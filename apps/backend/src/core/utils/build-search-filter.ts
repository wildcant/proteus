import type { FilterRecord } from './build-filters.js'

/**
 * What a storefront search word matches: a product's title or its brand. A title may leave the brand
 * out ("Retro 1 Negro" is a Jordan), so a search for "jordan" finds the Jordans by brand alone.
 */
export const PRODUCT_SEARCH_COLUMNS = ['title', 'brand']

export function buildSearchFilter(q: string, searchableColumns: string[]): FilterRecord {
  const tokens = q.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || searchableColumns.length === 0) return {}

  return {
    $and: tokens.map((token) => ({
      $or: searchableColumns.map((col) => ({
        [col]: { $ilike: `%${token}%` },
      })),
    })),
  } as FilterRecord
}
