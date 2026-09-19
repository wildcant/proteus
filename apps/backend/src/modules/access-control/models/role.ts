import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const roleTable = pgTable(
  'role',
  {
    id: text().primaryKey().default(sql`CONCAT('role_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    description: text(),
    isSuperAdmin: boolean().default(false).notNull(),
    protected: boolean().default(false).notNull(),
    featuresJson: jsonb().$type<string[]>().default(sql`'[]'`).notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_role_name').on(table.name)],
)

export type Role = typeof roleTable.$inferSelect
export type CreateRole = typeof roleTable.$inferInsert
