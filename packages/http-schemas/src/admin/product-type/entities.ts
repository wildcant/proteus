import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminProductType = z
  .object({
    id: z.string(),
    value: z.string(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductType')
export type AdminProductType = z.input<typeof AdminProductType>
