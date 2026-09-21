import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams } from '../../common.js'

export const AdminCustomerListParams = createFindParams().extend({
  q: z.string().optional(),
  id: z.union([z.string(), z.array(z.string())]).optional(),
  email: z.string().optional(),
  hasAccount: z.boolean().optional(),
  createdAt: createDateOperatorMap().optional(),
})

export type AdminCustomerListQuery = FindParams<typeof AdminCustomerListParams>
