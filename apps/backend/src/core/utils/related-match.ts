import type { StoreRelatedMatchDTO } from '../types/store/common.js'

/**
 * What the store relates products by when the structure file names no `related`: the Category, worth
 * most because a shelf is the merchant's own grouping; then the Product Type and the brand. Every
 * catalogue has these three, so a shop gets a related row with no configuration.
 */
export const DEFAULT_RELATED_MATCH: StoreRelatedMatchDTO[] = [
  { key: 'category', weight: 2 },
  { key: 'type', weight: 1 },
  { key: 'brand', weight: 1 },
]
