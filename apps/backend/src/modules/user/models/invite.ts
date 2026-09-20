import { sql } from 'drizzle-orm'
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'

export const inviteTable = pgTable(
  'invite',
  {
    id: text().primaryKey().default(sql`CONCAT('invite_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    email: text().notNull(),
    accepted: boolean().notNull().default(false),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    // TODO(RBAC): roles when RBAC is implemented
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_invite_email').on(table.email), liveIndex('idx_invite_token').on(table.token)],
)

export type Invite = typeof inviteTable.$inferSelect
export type CreateInvite = typeof inviteTable.$inferInsert
