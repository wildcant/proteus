import { sql } from 'drizzle-orm'
import { index, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { orderAddressTable } from './address.js'

export const orderStatusEnum = pgEnum('order_status', ['pending', 'completed', 'canceled', 'archived'])

export const orderFulfillmentStatusEnum = pgEnum('order_fulfillment_status', [
  'unfulfilled',
  'fulfilled',
  'shipped',
  'delivered',
])

export const orderTable = pgTable(
  'order',
  {
    id: text().primaryKey().default(sql`CONCAT('ord_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    displayId: serial().notNull(),
    status: orderStatusEnum().default('pending').notNull(),
    fulfillmentStatus: orderFulfillmentStatusEnum().default('unfulfilled').notNull(),
    email: text(),
    customerId: text(),
    currencyCode: text().notNull(),
    shippingAddressId: text().references(() => orderAddressTable.id),
    billingAddressId: text().references(() => orderAddressTable.id),
    canceledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index('idx_order_display_id').on(table.displayId).where(sql`deleted_at IS NULL`),
    index('idx_order_customer_id').on(table.customerId).where(sql`deleted_at IS NULL AND customer_id IS NOT NULL`),
    index('idx_order_currency_code').on(table.currencyCode).where(sql`deleted_at IS NULL`),
    index('idx_order_status').on(table.status).where(sql`deleted_at IS NULL`),
  ],
)

export type Order = typeof orderTable.$inferSelect
export type CreateOrder = typeof orderTable.$inferInsert
