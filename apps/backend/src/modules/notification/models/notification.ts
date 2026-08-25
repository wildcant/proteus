import { sql } from 'drizzle-orm'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import type { NotificationChannel } from '../../../core/types/notification/common.js'

export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'success', 'failure'])

export const notificationTable = pgTable(
  'notification',
  {
    id: text().primaryKey().default(sql`CONCAT('noti_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    // This can be an email, phone number, or username, depending on the channel.
    to: text().notNull(),
    // This can be an email, phone number, or username, depending on the channel.
    from: text(),
    channel: text().$type<NotificationChannel>().notNull(),
    // The template name in the provider's system.
    template: text(),
    // The data that gets passed over to the provider for rendering the notification.
    data: jsonb().$type<Record<string, unknown> | null>(),
    // Additional data specific to the channel or provider. For example, cc and bcc for emails.
    providerData: jsonb().$type<Record<string, unknown> | null>(),
    // This can be the event name, the workflow, or anything else that can help to identify what triggered the notification.
    triggerType: text(),
    // The ID of the resource this notification is for, if applicable. Useful for displaying relevant information in the UI
    resourceId: text(),
    // The typeame of the resource this notification is for, if applicable, eg. "order"
    resourceType: text(),
    // The ID of the receiver of the notification, if applicable. This can be a customer, user, a company, or anything else.
    receiverId: text(),
    // The original notification, in case this is a retried notification.
    originalNotificationId: text(),
    idempotencyKey: text(),
    // The ID of the notification in the external system, if applicable
    externalId: text(),
    // The status of the notification
    status: notificationStatusEnum().notNull().default('pending'),
    providerId: text(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_notification_idempotency_key', sql`idempotency_key IS NOT NULL`).on(table.idempotencyKey),
    liveIndex('idx_notification_channel').on(table.channel),
    liveIndex('idx_notification_status').on(table.status),
    liveIndex('idx_notification_provider_id').on(table.providerId),
    liveIndex('idx_notification_receiver_id').on(table.receiverId),
  ],
)

export type Notification = typeof notificationTable.$inferSelect
export type CreateNotification = typeof notificationTable.$inferInsert
