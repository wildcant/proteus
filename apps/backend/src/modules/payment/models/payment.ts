import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { paymentCollectionTable } from './payment-collection.js'
import { paymentSessionTable } from './payment-session.js'

export const paymentTable = pgTable(
  'payment',
  {
    id: text().primaryKey().default(sql`CONCAT('pay_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    amount: bignum().notNull(),
    canceledAt: timestamp({ withTimezone: true }),
    capturedAt: timestamp({ withTimezone: true }),
    currencyCode: text().notNull(),
    data: jsonb().$type<Record<string, unknown> | null>(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    paymentCollectionId: text()
      .notNull()
      .references(() => paymentCollectionTable.id, { onDelete: 'cascade' }),
    paymentSessionId: text()
      .notNull()
      .references(() => paymentSessionTable.id),
    providerId: text().notNull(),

    ...timestamps,
  },
  (table) => [
    liveIndex('idx_payment_provider_id').on(table.providerId),
    liveIndex('idx_payment_collection_id').on(table.paymentCollectionId),
    liveIndex('idx_payment_session_id').on(table.paymentSessionId),
  ],
)

export type Payment = typeof paymentTable.$inferSelect
export type CreatePayment = typeof paymentTable.$inferInsert
