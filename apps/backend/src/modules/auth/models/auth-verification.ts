import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import { authIdentityTable } from './auth-identity.js'

export const authVerificationTable = pgTable(
  'auth_verification',
  {
    id: text().primaryKey().default(sql`CONCAT('authver_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    authIdentityId: text()
      .notNull()
      .references(() => authIdentityTable.id, { onDelete: 'cascade' }),
    entityId: text().notNull(),
    entityType: text().notNull(),
    codeProvider: text().notNull(),
    verifiedAt: timestamp({ withTimezone: true }),
    requestedAt: timestamp({ withTimezone: true }).notNull(),
    providerMetadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_auth_verification_identity_entity').on(table.authIdentityId, table.entityId, table.entityType),
  ],
)

export type AuthVerification = typeof authVerificationTable.$inferSelect
export type CreateAuthVerification = typeof authVerificationTable.$inferInsert
