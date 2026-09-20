import { z } from 'zod'
import { dateToIso } from '../../common.js'

export const AdminPermission = z
  .object({
    id: z.string(),
    key: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    assignable: z.boolean(),
    registeredAt: dateToIso.nullable(),
    createdAt: dateToIso,
    updatedAt: dateToIso,
    deletedAt: dateToIso.nullable(),
  })
  .openapi('AdminPermission')
export type AdminPermission = z.input<typeof AdminPermission>
