import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
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
    liveIndex('idx_order_transaction_reference').on(table.reference, table.referenceId),
  ],
)

export type OrderTransaction = typeof orderTransactionTable.$inferSelect
export type CreateOrderTransaction = typeof orderTransactionTable.$inferInsert
