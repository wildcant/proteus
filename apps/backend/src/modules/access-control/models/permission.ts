import { sql } from 'drizzle-orm'
import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const permissionTable = pgTable(
  'ac_permission',
  {
    id: text().primaryKey().default(sql`CONCAT('acperm_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    key: text().notNull(),
    module: text().notNull(),
    title: text().notNull(),
    description: text(),
    assignable: boolean().default(true).notNull(),
    registeredAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_ac_permission_key').on(table.key)],
)

export type Permission = typeof permissionTable.$inferSelect
export type CreatePermission = typeof permissionTable.$inferInsert
