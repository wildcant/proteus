import { relations, sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../core/db/indexes.js'
import { inviteTable, roleTable } from '../modules-definitions.js'

export const inviteRoleTable = pgTable(
  'invite_role',
  {
    id: text().primaryKey().default(sql`CONCAT('invrl_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    inviteId: text().notNull(),
    roleId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_invrl_invite_role').on(table.inviteId, table.roleId),
    liveIndex('idx_invrl_invite_id').on(table.inviteId),
    liveIndex('idx_invrl_role_id').on(table.roleId),
  ],
)

export const inviteRoleRelations = relations(inviteRoleTable, ({ one }) => ({
  invite: one(inviteTable, {
    fields: [inviteRoleTable.inviteId],
    references: [inviteTable.id],
  }),
  role: one(roleTable, {
    fields: [inviteRoleTable.roleId],
    references: [roleTable.id],
  }),
}))
