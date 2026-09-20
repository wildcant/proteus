import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminUser } from './entities.js'

export const AdminUserResponse = z.object({ user: AdminUser }).openapi('AdminUserResponse')
export type AdminUserResponse = z.input<typeof AdminUserResponse>

export const AdminUserListResponse = PaginatedResponse.extend({ users: z.array(AdminUser) }).openapi(
  'AdminUserListResponse',
)
export type AdminUserListResponse = z.input<typeof AdminUserListResponse>
