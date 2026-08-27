import { and, desc, eq, inArray } from 'drizzle-orm'
import type { NotificationTemplate } from '../../../src/core/utils/notification-templates.js'
import { notificationTable } from '../../../src/schema.js'
import { db } from '../../db/client.js'

type NotificationFilters = {
  to: string
  template?: NotificationTemplate
}

/**
 * The most recent notification queued for an address, or null if none has been.
 *
 * Notifications are persisted with their rendered `data` before dispatch, so a test can
 * read what the shopper was actually sent — a verification link, an order number — instead
 * of reconstructing it. Returns null rather than throwing so callers can poll.
 */
export async function retrieveNotification(filters: NotificationFilters) {
  const conditions = [eq(notificationTable.to, filters.to)]
  if (filters.template) {
    conditions.push(eq(notificationTable.template, filters.template))
  }

  const rows = await db
    .select()
    .from(notificationTable)
    .where(and(...conditions))
    .orderBy(desc(notificationTable.createdAt))
    .limit(1)

  return rows[0] ?? null
}

/** Takes a list because one flow can queue several: each unverified auth attempt emails again. */
export async function deleteNotificationsByIds(notificationIds: string[]) {
  if (notificationIds.length === 0) return
  await db.delete(notificationTable).where(inArray(notificationTable.id, notificationIds))
}
