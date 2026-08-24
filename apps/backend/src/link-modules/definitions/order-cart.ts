import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveUniqueIndex } from '../../core/db/indexes.js'

export const orderCartTable = pgTable(
  'order_cart',
  {
    id: text().primaryKey().default(sql`CONCAT('ordcart_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    cartId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_order_cart').on(table.orderId, table.cartId),
    /** A cart is completed at most once, so it can back at most one order. Enforced here
     *  rather than in the workflow because concurrent completions each pass the
     *  `check-idempotency` read before any of them writes — only the database can arbitrate. */
    liveUniqueIndex('idx_order_cart_cart_id').on(table.cartId),
  ],
)

export type OrderCart = typeof orderCartTable.$inferSelect
export type CreateOrderCart = typeof orderCartTable.$inferInsert
