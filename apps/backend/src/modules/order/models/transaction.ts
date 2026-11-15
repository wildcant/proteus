import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { orderTable } from './order.js'

export const orderTransactionTable = pgTable(
  'order_transaction',
  {
    id: text().primaryKey().default(sql`CONCAT('ordtrx_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text()
      .notNull()
      .references(() => orderTable.id, { onDelete: 'cascade' }),
    amount: bignum().notNull(),
    currencyCode: text().notNull(),
    reference: text(),
    referenceId: text(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_order_transaction_order_id').on(table.orderId),
    /**
     * One live transaction per payment-module row it records — a capture or a refund. The workflow
     * step that writes it can run twice (a retry, or a later run converging on the same capture),
     * and the second write has to land on this slot rather than double the Order's Paid Total.
     */
    liveUniqueIndex('idx_order_transaction_reference').on(table.reference, table.referenceId),
  ],
)

export type OrderTransaction = typeof orderTransactionTable.$inferSelect
export type CreateOrderTransaction = typeof orderTransactionTable.$inferInsert
