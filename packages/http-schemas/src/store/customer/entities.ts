import { z } from 'zod'
import { timestamps } from '../../common.js'

export const Customer = z
  .object({
    id: z.string(),
    hasAccount: z.boolean(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    email: z.string(),
    ...timestamps.shape,
  })
  .openapi('Customer')
export type Customer = z.input<typeof Customer>
