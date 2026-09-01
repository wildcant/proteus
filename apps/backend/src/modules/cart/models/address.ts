import { sql } from 'drizzle-orm'
import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import { cartTable } from './cart.js'

export const cartAddressTypeEnum = pgEnum('cart_address_type', ['shipping', 'billing'])

/** A cart's own copy of an address, one row per `type`. Mirrors `order_address` — see the note there. */
export const cartAddressTable = pgTable(
  'cart_address',
  {
    id: text().primaryKey().default(sql`CONCAT('caaddr_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    cartId: text()
      .notNull()
      .references(() => cartTable.id, { onDelete: 'cascade' }),
    type: cartAddressTypeEnum().notNull(),
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
  // Leads with `cartId`, so it also serves the cascade's read of a cart's addresses.
  (table) => [liveUniqueIndex('idx_cart_address_unique_cart_type').on(table.cartId, table.type)],
)

export type CartAddress = typeof cartAddressTable.$inferSelect
export type CreateCartAddress = typeof cartAddressTable.$inferInsert
