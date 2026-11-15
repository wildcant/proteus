import { sql } from 'drizzle-orm'
import { jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'

export const paymentCollectionStatusEnum = pgEnum('payment_collection_status', [
  'not_paid',
  'awaiting',
  'authorized',
  'partially_authorized',
  'partially_captured',
  'completed',
  'canceled',
])

export const paymentCollectionTable = pgTable(
  'payment_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('pay_col_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    amount: bignum().notNull(),
    authorizedAmount: bignum(),
    capturedAmount: bignum(),
    /** Set when the Order holding the collection is canceled: no capture or authorization lands on it after. */
    canceledAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    currencyCode: text().notNull().default('usd'),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    refundedAmount: bignum(),
    status: paymentCollectionStatusEnum().notNull().default('not_paid'),

    ...timestamps,
  },
  (table) => [liveIndex('idx_payment_collection_status').on(table.status)],
)

export type PaymentCollection = typeof paymentCollectionTable.$inferSelect
export type CreatePaymentCollection = typeof paymentCollectionTable.$inferInsert
