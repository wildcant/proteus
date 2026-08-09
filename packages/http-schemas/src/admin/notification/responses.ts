import { z } from 'zod'
import { PaginatedResponse } from '../../common.js'
import { AdminNotification } from './entities.js'

export const AdminNotificationResponse = z
  .object({ notification: AdminNotification })
  .openapi('AdminNotificationResponse')
export type AdminNotificationResponse = z.input<typeof AdminNotificationResponse>

export const AdminNotificationListResponse = PaginatedResponse.extend({
  notifications: z.array(AdminNotification),
}).openapi('AdminNotificationListResponse')
export type AdminNotificationListResponse = z.input<typeof AdminNotificationListResponse>
