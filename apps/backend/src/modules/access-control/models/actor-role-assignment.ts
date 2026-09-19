import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import { roleTable } from './role.js'

export const actorRoleAssignmentTable = pgTable(
  'actor_role_assignment',
  {
    id: text().primaryKey().default(sql`CONCAT('ara_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    actorType: text().notNull(),
    actorId: text().notNull(),
    roleId: text()
      .notNull()
      .references(() => roleTable.id),
    expiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_actor_role_assignment_actor_role').on(table.actorType, table.actorId, table.roleId)],
)

export type ActorRoleAssignment = typeof actorRoleAssignmentTable.$inferSelect
export type CreateActorRoleAssignment = typeof actorRoleAssignmentTable.$inferInsert
