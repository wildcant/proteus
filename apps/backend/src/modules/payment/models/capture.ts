import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { paymentTable } from './payment.js'

export const captureTable = pgTable(
  'capture',
  {
    id: text().primaryKey().default(sql`CONCAT('capt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    amount: bignum().notNull(),
    createdBy: text(),
    /**
     * The caller's name for this capture, so a workflow step that runs twice records it once. A
     * capture is money taken, and a retried step that captured again would take a second deposit
     * the shopper never paid. Null for a capture nobody needs to repeat safely.
     */
    idempotencyKey: text(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    paymentId: text()
      .notNull()
      .references(() => paymentTable.id, { onDelete: 'cascade' }),

    ...timestamps,
  },
  (table) => [
    liveIndex('idx_capture_payment_id').on(table.paymentId),
    liveUniqueIndex('idx_capture_idempotency_key', sql`idempotency_key IS NOT NULL`).on(table.idempotencyKey),
  ],
)

export type Capture = typeof captureTable.$inferSelect
export type CreateCapture = typeof captureTable.$inferInsert
