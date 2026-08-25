import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import { orderTable } from './order.js'

export const orderAddressTypeEnum = pgEnum('order_address_type', ['shipping', 'billing'])

/**
 * An order's own copy of an address, one row per `type`. The reference lives here rather than on
 * the order so that `on delete cascade` reaches it — see ADR 0016 for why that direction.
 *
 * Replacing an address updates the row holding that type. The unique index skips soft-deleted
 * rows, so removing one frees the slot.
 */
export const orderAddressTable = pgTable(
  'order_address',
  {
    id: text().primaryKey().default(sql`CONCAT('ordaddr_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text()
      .notNull()
      .references(() => orderTable.id, { onDelete: 'cascade' }),
    type: orderAddressTypeEnum().notNull(),
    customerId: text(),
    company: text(),
    firstName: text(),
    lastName: text(),
    address1: text('address_1'),
    address2: text('address_2'),
    city: text(),
    countryCode: text(),
    province: text(),
    postalCode: text(),
    phone: text(),
    ...timestamps,
  },
  // Leads with `orderId`, so it also serves the cascade's read of an order's addresses.
  (table) => [liveUniqueIndex('idx_order_address_unique_order_type').on(table.orderId, table.type)],
)

export type OrderAddress = typeof orderAddressTable.$inferSelect
export type CreateOrderAddress = typeof orderAddressTable.$inferInsert
