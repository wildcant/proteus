import { sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { orderTable } from './order.js'

export const orderShippingMethodTable = pgTable(
  'order_shipping_method',
  {
    id: text().primaryKey().default(sql`CONCAT('ordsm_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text()
      .notNull()
      .references(() => orderTable.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    amount: bignum().notNull(),
    shippingOptionId: text(),
    data: jsonb(),
    ...timestamps,
  },
  (table) => [
    index('idx_order_shipping_method_order_id').on(table.orderId).where(sql`deleted_at IS NULL`),
    index('idx_order_shipping_method_option_id')
      .on(table.shippingOptionId)
      .where(sql`deleted_at IS NULL AND shipping_option_id IS NOT NULL`),
  ],
)

export type OrderShippingMethod = typeof orderShippingMethodTable.$inferSelect
export type CreateOrderShippingMethod = typeof orderShippingMethodTable.$inferInsert
