import { z } from 'zod'
import { AdminPermission } from './entities.js'

export const AdminPermissionResponse = z.object({ permission: AdminPermission }).openapi('AdminPermissionResponse')
export type AdminPermissionResponse = z.input<typeof AdminPermissionResponse>

export const AdminPermissionListResponse = z
  .object({ permissions: z.array(AdminPermission) })
  .openapi('AdminPermissionListResponse')
export type AdminPermissionListResponse = z.input<typeof AdminPermissionListResponse>
