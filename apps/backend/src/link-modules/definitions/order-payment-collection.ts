import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveUniqueIndex } from '../../core/db/indexes.js'

export const orderPaymentCollectionTable = pgTable(
  'order_payment_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('ordpaycol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    paymentCollectionId: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_order_payment_collection').on(table.orderId, table.paymentCollectionId)],
)

export type OrderPaymentCollection = typeof orderPaymentCollectionTable.$inferSelect
export type CreateOrderPaymentCollection = typeof orderPaymentCollectionTable.$inferInsert
