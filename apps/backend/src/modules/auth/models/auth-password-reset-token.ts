import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { authIdentityTable } from './auth-identity.js'
import { providerIdentityTable } from './provider-identity.js'

// Destroy-only on purpose: a single-use bearer credential whose threat model is the retained hash,
// and restoring a spent one has no meaning. It carries createdAt/updatedAt by hand and no deletedAt,
// so the cascade walker hard-deletes it with the identity it belongs to.
// ast-grep-ignore: model-without-standard-timestamps
export const authPasswordResetTokenTable = pgTable(
  'auth_password_reset_token',
  {
    id: text().primaryKey().default(sql`CONCAT('authprt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    authIdentityId: text()
      .notNull()
      .references(() => authIdentityTable.id, { onDelete: 'cascade' }),
    providerIdentityId: text()
      .notNull()
      .references(() => providerIdentityTable.id, { onDelete: 'cascade' }),
    entityId: text().notNull(),
    tokenHash: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).default(sql`now()`).notNull(),
    updatedAt: timestamp({ withTimezone: true }).default(sql`now()`).notNull(),
  },
  (table) => [
    index('idx_auth_password_reset_token_auth_identity').on(table.authIdentityId),
    index('idx_auth_password_reset_token_provider_identity').on(table.providerIdentityId),
    index('idx_auth_password_reset_token_hash').on(table.tokenHash),
  ],
)

export type AuthPasswordResetToken = typeof authPasswordResetTokenTable.$inferSelect
export type CreateAuthPasswordResetToken = typeof authPasswordResetTokenTable.$inferInsert
