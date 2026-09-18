import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const actorRoleAssignmentTable = pgTable(
  'ac_actor_role_assignment',
  {
    id: text().primaryKey().default(sql`CONCAT('acassign_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    actorType: text().notNull().default('user'),
    actorId: text().notNull(),
    roleId: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_ac_actor_role_unique').on(table.actorType, table.actorId, table.roleId)],
)

export type ActorRoleAssignment = typeof actorRoleAssignmentTable.$inferSelect
export type CreateActorRoleAssignment = typeof actorRoleAssignmentTable.$inferInsert
