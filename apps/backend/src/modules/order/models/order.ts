import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'

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
    email: text().notNull(),
    customerId: text(),
    currencyCode: text().notNull(),
    canceledAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_order_display_id').on(table.displayId),
    liveIndex('idx_order_customer_id', sql`customer_id IS NOT NULL`).on(table.customerId),
    liveIndex('idx_order_currency_code').on(table.currencyCode),
    liveIndex('idx_order_status').on(table.status),
  ],
)

export type Order = typeof orderTable.$inferSelect
export type CreateOrder = typeof orderTable.$inferInsert
