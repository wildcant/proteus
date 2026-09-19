import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminUser } from './entities.js'

export const AdminUserResponse = z.object({ user: AdminUser }).openapi('AdminUserResponse')
export type AdminUserResponse = z.input<typeof AdminUserResponse>

const SidebarItem = z.object({
  label: z.string(),
  to: z.string(),
  icon: z.string().optional(),
})

const SidebarGroup = z.object({
  label: z.string(),
  items: z.array(SidebarItem),
})

const AdminUserRole = z.object({
  id: z.string(),
  name: z.string(),
})

export const AdminMeResponse = z
  .object({
    user: AdminUser.extend({ roles: z.array(AdminUserRole) }),
    allowedActions: z.array(z.string()),
    sidebar: z.array(SidebarGroup),
    settingsSidebar: z.array(SidebarGroup),
  })
  .openapi('AdminMeResponse')
export type AdminMeResponse = z.input<typeof AdminMeResponse>

export const AdminUserListResponse = PaginatedResponse.extend({ users: z.array(AdminUser) }).openapi(
  'AdminUserListResponse',
)
export type AdminUserListResponse = z.input<typeof AdminUserListResponse>
