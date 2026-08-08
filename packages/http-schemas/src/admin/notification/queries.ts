import { z } from 'zod'
import { createDateOperatorMap, createFindParams, type FindParams } from '../../common.js'
import { NotificationChannel } from './entities.js'

export const AdminNotificationListParams = createFindParams({ limit: 50 }).extend({
  q: z.string().optional(),
  id: z.union([z.string(), z.array(z.string())]).optional(),
  to: z.union([z.string(), z.array(z.string())]).optional(),
  channel: z.union([NotificationChannel, z.array(NotificationChannel)]).optional(),
  createdAt: createDateOperatorMap().optional(),
})

export type AdminNotificationListQuery = FindParams<typeof AdminNotificationListParams>
