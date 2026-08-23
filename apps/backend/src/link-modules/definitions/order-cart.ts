import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'

export const orderCartTable = pgTable(
  'order_cart',
  {
    id: text().primaryKey().default(sql`CONCAT('ordcart_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    cartId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_order_cart').on(table.orderId, table.cartId).where(sql`deleted_at IS NULL`),
    /** A cart is completed at most once, so it can back at most one order. Enforced here
     *  rather than in the workflow because concurrent completions each pass the
     *  `check-idempotency` read before any of them writes — only the database can arbitrate. */
    uniqueIndex('idx_order_cart_cart_id').on(table.cartId).where(sql`deleted_at IS NULL`),
  ],
)

export type OrderCart = typeof orderCartTable.$inferSelect
export type CreateOrderCart = typeof orderCartTable.$inferInsert
