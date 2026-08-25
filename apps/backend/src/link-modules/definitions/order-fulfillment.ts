import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveUniqueIndex } from '../../core/db/indexes.js'

export const orderFulfillmentTable = pgTable(
  'order_fulfillment',
  {
    id: text().primaryKey().default(sql`CONCAT('ordful_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    fulfillmentId: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_order_fulfillment').on(table.orderId, table.fulfillmentId)],
)

export type OrderFulfillment = typeof orderFulfillmentTable.$inferSelect
export type CreateOrderFulfillment = typeof orderFulfillmentTable.$inferInsert
