import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import type { PermissionGrant } from '../../../core/types/access-control/common.js'

export const roleTable = pgTable(
  'ac_role',
  {
    id: text().primaryKey().default(sql`CONCAT('acrole_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    description: text(),
    features: jsonb().$type<PermissionGrant[]>().default([]).notNull(),
    isImmutable: boolean().default(false).notNull(),
    isSuperAdmin: boolean().default(false).notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_ac_role_name').on(table.name)],
)

export type Role = typeof roleTable.$inferSelect
export type CreateRole = typeof roleTable.$inferInsert
