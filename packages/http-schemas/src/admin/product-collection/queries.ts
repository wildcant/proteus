import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminProductCollectionListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminProductCollectionListQuery = FindParams<typeof AdminProductCollectionListParams>
