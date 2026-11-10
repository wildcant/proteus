import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const StoreProductListParams = createFindParams().extend({
  q: z.string().optional(),
  /** A Category's handle. Lists its products and its Visible descendants'; a hidden Category matches nothing. */
  category: z.string().min(1).optional(),
})

export type StoreProductListQuery = FindParams<typeof StoreProductListParams>
