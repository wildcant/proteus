import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminProductTypeListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminProductTypeListQuery = FindParams<typeof AdminProductTypeListParams>
