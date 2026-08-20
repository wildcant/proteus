import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { cartAddressTable } from './address.js'

export const cartStatusEnum = pgEnum('cart_status', ['active', 'completed', 'abandoned'])

export const cartTable = pgTable(
  'cart',
  {
    id: text().primaryKey().default(sql`CONCAT('cart_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    regionId: text(),
    customerId: text(),
    salesChannelId: text(),
    email: text(),
    currencyCode: text().notNull(),
    status: cartStatusEnum().default('active').notNull(),
    shippingAddressId: text().references(() => cartAddressTable.id),
    billingAddressId: text().references(() => cartAddressTable.id),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('idx_cart_customer_id').on(table.customerId).where(sql`deleted_at IS NULL AND customer_id IS NOT NULL`),
    index('idx_cart_currency_code').on(table.currencyCode).where(sql`deleted_at IS NULL`),
    index('idx_cart_region_id').on(table.regionId).where(sql`deleted_at IS NULL AND region_id IS NOT NULL`),
    index('idx_cart_sales_channel_id')
      .on(table.salesChannelId)
      .where(sql`deleted_at IS NULL AND sales_channel_id IS NOT NULL`),
  ],
)

export type Cart = typeof cartTable.$inferSelect
export type CreateCart = typeof cartTable.$inferInsert
