import { z } from 'zod'
import { timestamps } from '../../common.js'

export const AdminRole = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    isSuperAdmin: z.boolean(),
    protected: z.boolean(),
    features: z.array(z.string()),
    ...timestamps.shape,
  })
  .openapi('AdminRole')
export type AdminRole = z.input<typeof AdminRole>
