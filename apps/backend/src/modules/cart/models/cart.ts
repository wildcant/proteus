import { sql } from 'drizzle-orm'
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'

export const cartTable = pgTable(
  'cart',
  {
    id: text().primaryKey().default(sql`CONCAT('cart_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    regionId: text(),
    customerId: text(),
    salesChannelId: text(),
    email: text(),
    currencyCode: text().notNull(),
    /** Null while the cart is still being shopped; stamped once, when it becomes an order */
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_cart_customer_id', sql`customer_id IS NOT NULL`).on(table.customerId),
    liveIndex('idx_cart_currency_code').on(table.currencyCode),
    liveIndex('idx_cart_region_id', sql`region_id IS NOT NULL`).on(table.regionId),
    liveIndex('idx_cart_sales_channel_id', sql`sales_channel_id IS NOT NULL`).on(table.salesChannelId),
  ],
)

export type Cart = typeof cartTable.$inferSelect
export type CreateCart = typeof cartTable.$inferInsert
