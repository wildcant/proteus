import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminProductTag = z
  .object({
    id: z.string(),
    value: z.string(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
  })
  .openapi('AdminProductTag')
export type AdminProductTag = z.input<typeof AdminProductTag>
