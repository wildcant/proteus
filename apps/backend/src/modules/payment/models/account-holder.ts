import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const accountHolderTable = pgTable(
  'account_holder',
  {
    id: text().primaryKey().default(sql`CONCAT('acchld_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    /**
     * The Proteus Customer this holder stands for, and the only key anything looks it up by.
     *
     * Nullable because `externalId` is what identifies the holder *at the gateway* and a holder
     * can exist without a Proteus account behind it — an admin-created one, a legacy row. The
     * unique index below is the invariant that matters: one account holder per customer per
     * provider, enforced where two concurrent checkouts collide rather than in a read-then-write
     * that both of them pass.
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
