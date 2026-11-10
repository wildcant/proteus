import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminProductTagListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminProductTagListQuery = FindParams<typeof AdminProductTagListParams>
