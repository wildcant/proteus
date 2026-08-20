import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const CustomerListParams = createFindParams().extend({
  id: z.union([z.string(), z.array(z.string())]).optional(),
  email: z.string().optional(),
  hasAccount: z.boolean().optional(),
})

export type CustomerListQuery = FindParams<typeof CustomerListParams>
