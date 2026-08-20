import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'

export const orderPaymentCollectionTable = pgTable(
  'order_payment_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('ordpaycol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    paymentCollectionId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_order_payment_collection')
      .on(table.orderId, table.paymentCollectionId)
      .where(sql`deleted_at IS NULL`),
  ],
)

export type OrderPaymentCollection = typeof orderPaymentCollectionTable.$inferSelect
export type CreateOrderPaymentCollection = typeof orderPaymentCollectionTable.$inferInsert
