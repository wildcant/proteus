import { sql } from 'drizzle-orm'
import { boolean, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import type { NotificationChannel } from '../../../core/types/notification/common.js'

export const notificationProviderTable = pgTable('notification_provider', {
  id: text().primaryKey().default(sql`CONCAT('notpro_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  name: text().notNull(),
  isEnabled: boolean().notNull().default(true),
  channels: text().$type<NotificationChannel>().array().notNull().default([]),
  ...timestamps,
})

export type NotificationProvider = typeof notificationProviderTable.$inferSelect
export type CreateNotificationProvider = typeof notificationProviderTable.$inferInsert
