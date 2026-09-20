import { z } from 'zod'
import { MAX_ITEMS, shortText } from '../../bounded.js'

export const AdminCreateRole = z
  .object({
    name: shortText.min(1),
    description: shortText.optional(),
    features: z.array(z.string()).max(MAX_ITEMS.bulk),
  })
  .openapi('AdminCreateRole')
export type AdminCreateRoleBody = z.infer<typeof AdminCreateRole>

export const AdminUpdateRole = z
  .object({
    name: shortText.min(1).optional(),
    description: shortText.nullable().optional(),
    features: z.array(z.string()).max(MAX_ITEMS.bulk).optional(),
  })
  .openapi('AdminUpdateRole')
export type AdminUpdateRoleBody = z.infer<typeof AdminUpdateRole>

export const AdminReplaceUserRoles = z
  .object({
    roleIds: z.array(z.string()).max(MAX_ITEMS.batch),
  })
  .openapi('AdminReplaceUserRoles')
export type AdminReplaceUserRolesBody = z.infer<typeof AdminReplaceUserRoles>
