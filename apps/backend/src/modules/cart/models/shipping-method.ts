import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { cartTable } from './cart.js'

export const cartShippingMethodTable = pgTable(
  'cart_shipping_method',
  {
    id: text().primaryKey().default(sql`CONCAT('casm_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    cartId: text()
      .notNull()
      .references(() => cartTable.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    amount: bignum().notNull(),
    isTaxInclusive: boolean().default(false).notNull(),
    shippingOptionId: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_cart_shipping_method_cart_id').on(table.cartId),
    liveIndex('idx_cart_shipping_method_option_id', sql`shipping_option_id IS NOT NULL`).on(table.shippingOptionId),
  ],
)

export type CartShippingMethod = typeof cartShippingMethodTable.$inferSelect
export type CreateCartShippingMethod = typeof cartShippingMethodTable.$inferInsert
