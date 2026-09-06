import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const accountHolderTable = pgTable(
  'account_holder',
  {
    id: text().primaryKey().default(sql`CONCAT('acchld_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    /**
     * Nullable because `externalId` identifies the holder at the gateway, so one can exist
     * without a Proteus account behind it. The unique index below carries the real invariant:
     * one holder per customer per provider, enforced where concurrent checkouts collide.
     */
    customerId: text(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    email: text(),
    externalId: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    providerId: text().notNull(),

    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_account_holder_provider_external').on(table.providerId, table.externalId),
    liveUniqueIndex('idx_account_holder_provider_customer').on(table.providerId, table.customerId),
  ],
)

export type AccountHolder = typeof accountHolderTable.$inferSelect
export type CreateAccountHolder = typeof accountHolderTable.$inferInsert
