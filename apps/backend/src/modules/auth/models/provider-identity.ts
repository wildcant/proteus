import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { authIdentityTable } from './auth-identity.js'

export const providerIdentityTable = pgTable(
  'provider_identity',
  {
    id: text().primaryKey().default(sql`CONCAT('provid_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    authIdentityId: text()
      .notNull()
      .references(() => authIdentityTable.id, { onDelete: 'cascade' }),
    entityId: text().notNull(),
    provider: text().notNull(),
    providerMetadata: jsonb().$type<Record<string, unknown> | null>(),
    userMetadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_provider_identity_auth_identity_id').on(table.authIdentityId),
    liveUniqueIndex('idx_provider_identity_entity_provider').on(table.entityId, table.provider),
  ],
)

export type ProviderIdentity = typeof providerIdentityTable.$inferSelect
export type CreateProviderIdentity = typeof providerIdentityTable.$inferInsert
