import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams, searchTerm } from '../../common.js'

export const AdminCustomerListParams = createFindParams().extend({
  q: searchTerm,
  id: z.union([z.string(), z.array(z.string())]).optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  hasAccount: z.boolean().optional(),
  createdAt: createDateOperatorMap().optional(),
})

export type AdminCustomerListQuery = FindParams<typeof AdminCustomerListParams>
