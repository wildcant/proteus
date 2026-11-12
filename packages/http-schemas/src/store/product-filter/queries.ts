import type { z } from 'zod'
import { StoreProductListParams } from '../product/queries.js'

/**
 * The product list the filters sit above: the keys `GET /store/products` takes, minus paging. Its
 * scope decides which values are offered; its Tag and metafield selections only narrow the counts.
 */
export const StoreProductFilterListParams = StoreProductListParams.pick({
  q: true,
  category: true,
  collection: true,
  tag: true,
  filter: true,
})
export type StoreProductFilterListQuery = z.infer<typeof StoreProductFilterListParams>
