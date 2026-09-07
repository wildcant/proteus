import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminRegionListParams = createFindParams().extend({
  q: z.string().optional(),
})
export type AdminRegionListQuery = FindParams<typeof AdminRegionListParams>
