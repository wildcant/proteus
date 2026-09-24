import { z } from 'zod'
import { timestamps } from '../../common.js'

export const AdminUser = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    locale: z.string(),
    ...timestamps.shape,
  })
  .openapi('AdminUser')
export type AdminUser = z.input<typeof AdminUser>
