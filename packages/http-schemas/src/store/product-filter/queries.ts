import type { z } from 'zod'
import { StoreProductListParams } from '../product/queries.js'

/**
 * The product list the filters sit above: the keys `GET /store/products` takes, minus paging. Its
 * scope decides which values are offered; its Tag and filter selections only narrow the counts, and its price range narrows the products counted.
 */
export const StoreProductFilterListParams = StoreProductListParams.pick({
  q: true,
  category: true,
  collection: true,
  tag: true,
  filter: true,
  minPrice: true,
  maxPrice: true,
})
export type StoreProductFilterListQuery = z.infer<typeof StoreProductFilterListParams>
