import { sql } from 'drizzle-orm'
import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
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
    index('idx_order_transaction_order_id').on(table.orderId).where(sql`deleted_at IS NULL`),
    index('idx_order_transaction_reference').on(table.reference, table.referenceId).where(sql`deleted_at IS NULL`),
  ],
)

export type OrderTransaction = typeof orderTransactionTable.$inferSelect
export type CreateOrderTransaction = typeof orderTransactionTable.$inferInsert
