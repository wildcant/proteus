import { z } from 'zod'
import { createFindParams, type FindParams } from '../../common.js'

export const AdminCustomerListParams = createFindParams().extend({
  id: z.union([z.string(), z.array(z.string())]).optional(),
  email: z.string().optional(),
  hasAccount: z.boolean().optional(),
})

export type AdminCustomerListQuery = FindParams<typeof AdminCustomerListParams>
