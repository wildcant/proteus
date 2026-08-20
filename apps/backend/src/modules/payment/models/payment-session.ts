import { sql } from 'drizzle-orm'
import { index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
export const paymentSessionStatusEnum = pgEnum('payment_session_status', [
  'pending',
  'authorized',
  'captured',
  'requires_more',
  'error',
  'canceled',
  'pending_authorization',
])

import { paymentCollectionTable } from './payment-collection.js'

export const paymentSessionTable = pgTable(
  'payment_session',
  {
    id: text().primaryKey().default(sql`CONCAT('payses_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    amount: bignum().notNull(),
    authorizedAt: timestamp({ withTimezone: true }),
    context: jsonb().$type<Record<string, unknown> | null>(),
    currencyCode: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    paymentCollectionId: text()
      .notNull()
      .references(() => paymentCollectionTable.id),
    providerId: text().notNull(),
    status: paymentSessionStatusEnum().notNull().default('pending'),

    ...timestamps,
  },
  (table) => [index('idx_payment_session_collection_id').on(table.paymentCollectionId).where(sql`deleted_at IS NULL`)],
)

export type PaymentSession = typeof paymentSessionTable.$inferSelect
export type CreatePaymentSession = typeof paymentSessionTable.$inferInsert
