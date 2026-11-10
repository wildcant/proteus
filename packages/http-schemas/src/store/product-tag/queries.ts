import type { z } from 'zod'
import { StoreProductListParams } from '../product/queries.js'

/**
 * The scope of the product list the chips sit above: the keys `GET /store/products` takes, minus
 * `tag` and paging. The values offered are the ones the list shows before any Tag is chosen.
 */
export const StoreProductTagValueListParams = StoreProductListParams.pick({ q: true, category: true, collection: true })
export type StoreProductTagValueListQuery = z.infer<typeof StoreProductTagValueListParams>
