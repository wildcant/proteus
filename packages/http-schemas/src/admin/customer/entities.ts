import { z } from 'zod'
import { timestamps } from '../../common.js'

export const AdminCustomer = z
  .object({
    id: z.string(),
    hasAccount: z.boolean(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string(),
    ...timestamps.shape,
  })
  .openapi('AdminCustomer')
export type AdminCustomer = z.input<typeof AdminCustomer>
