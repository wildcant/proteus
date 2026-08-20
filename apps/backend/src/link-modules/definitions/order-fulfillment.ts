import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'

export const orderFulfillmentTable = pgTable(
  'order_fulfillment',
  {
    id: text().primaryKey().default(sql`CONCAT('ordful_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    fulfillmentId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_order_fulfillment').on(table.orderId, table.fulfillmentId).where(sql`deleted_at IS NULL`),
  ],
)

export type OrderFulfillment = typeof orderFulfillmentTable.$inferSelect
export type CreateOrderFulfillment = typeof orderFulfillmentTable.$inferInsert
