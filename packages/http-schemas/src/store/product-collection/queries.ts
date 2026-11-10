import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const StoreProductCollectionListParams = createFindParams().extend({
  /** One handle or several: a collection page asks for its own. */
  handle: z.union([z.string().min(1), z.string().min(1).array()]).optional(),
})
export type StoreProductCollectionListQuery = FindParams<typeof StoreProductCollectionListParams>
