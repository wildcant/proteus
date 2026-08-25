import { sql } from 'drizzle-orm'
import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
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
      .references(() => paymentTable.id, { onDelete: 'cascade' }),

    ...timestamps,
  },
  (table) => [liveIndex('idx_capture_payment_id').on(table.paymentId)],
)

export type Capture = typeof captureTable.$inferSelect
export type CreateCapture = typeof captureTable.$inferInsert
