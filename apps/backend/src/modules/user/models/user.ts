import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const userTable = pgTable(
  'user',
  {
    id: text().primaryKey().default(sql`CONCAT('usr_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    email: text().notNull(),
    name: text().notNull(),
    ...timestamps,
  },
  // An inline `.unique()` becomes a table constraint, which cannot carry a predicate — so a
  // soft-deleted user would hold their email address forever. Declared here instead.
  (table) => [liveUniqueIndex('idx_user_email').on(table.email)],
)

export type User = typeof userTable.$inferSelect
export type CreateUser = typeof userTable.$inferInsert
