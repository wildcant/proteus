import { sql } from 'drizzle-orm'
import { boolean, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'

/** `draft` is an Order the shop has not confirmed yet: it reserves nothing and holds no payment collection. */
export const orderStatusEnum = pgEnum('order_status', ['draft', 'pending', 'completed', 'canceled', 'archived'])

export const orderTable = pgTable(
  'order',
  {
    id: text().primaryKey().default(sql`CONCAT('ord_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    displayId: serial().notNull(),
    status: orderStatusEnum().default('pending').notNull(),
    /** Whether the Order began as a Draft Order and was never converted. Kept beside `status`, as in
     *  Medusa, because a canceled draft is `canceled` and must still stay out of the orders list. */
    isDraftOrder: boolean().default(false).notNull(),
    /** Null when the shopper sent the order without one; the confirmation email is skipped then. */
    email: text(),
    customerId: text(),
    /** Copied from the Cart, so a draft can still be priced in its region after the Cart closes. */
    regionId: text(),
    salesChannelId: text(),
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
