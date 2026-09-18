import { z } from 'zod'
import { AdminRole } from './entities.js'

export const AdminRoleResponse = z.object({ role: AdminRole }).openapi('AdminRoleResponse')
export type AdminRoleResponse = z.input<typeof AdminRoleResponse>

export const AdminRoleListResponse = z.object({ roles: z.array(AdminRole) }).openapi('AdminRoleListResponse')
export type AdminRoleListResponse = z.input<typeof AdminRoleListResponse>

export const AdminRoleDetailResponse = z
  .object({
    role: AdminRole.extend({ userCount: z.number() }),
  })
  .openapi('AdminRoleDetailResponse')
export type AdminRoleDetailResponse = z.input<typeof AdminRoleDetailResponse>

export const AdminUserRolesResponse = z.object({ roles: z.array(AdminRole) }).openapi('AdminUserRolesResponse')
export type AdminUserRolesResponse = z.input<typeof AdminUserRolesResponse>
