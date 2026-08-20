import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { paymentTable } from './payment.js'

export const captureTable = pgTable(
  'capture',
  {
    id: text().primaryKey().default(sql`CONCAT('capt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    amount: bignum().notNull(),
    createdBy: text(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    paymentId: text()
      .notNull()
      .references(() => paymentTable.id),

    ...timestamps,
  },
  (table) => [index('idx_capture_payment_id').on(table.paymentId).where(sql`deleted_at IS NULL`)],
)

export type Capture = typeof captureTable.$inferSelect
export type CreateCapture = typeof captureTable.$inferInsert
