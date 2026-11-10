import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const StoreProductListParams = createFindParams().extend({
  q: z.string().optional(),
  /** A Category's handle. Lists its products and its Visible descendants'; a hidden Category matches nothing. */
  category: z.string().min(1).optional(),
  /** A Collection's handle. Lists its members; an unknown or deleted Collection matches nothing. */
  collection: z.string().min(1).optional(),
  /** Tag values, repeatable. Lists products carrying any of them; an unknown value matches nothing. */
  tag: z.union([z.string().min(1), z.string().min(1).array()]).optional(),
})

export type StoreProductListQuery = FindParams<typeof StoreProductListParams>
