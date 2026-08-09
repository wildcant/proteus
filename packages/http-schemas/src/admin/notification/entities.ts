import { z } from 'zod'
import { timestamps } from '../../common.js'

export const NotificationStatus = z.enum(['pending', 'success', 'failure'])
export const NotificationChannel = z.enum(['email', 'sms', 'feed'])

export const AdminNotification = z
  .object({
    id: z.string(),
    to: z.string(),
    channel: NotificationChannel,
    template: z.string().nullable(),
    data: z.record(z.string(), z.unknown()).nullable(),
    triggerType: z.string().nullable(),
    resourceId: z.string().nullable(),
    resourceType: z.string().nullable(),
    receiverId: z.string().nullable(),
    ...timestamps.shape,
  })
  .openapi('AdminNotification')
export type AdminNotification = z.input<typeof AdminNotification>
