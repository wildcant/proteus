import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveUniqueIndex } from '../../core/db/indexes.js'

export const cartPaymentCollectionTable = pgTable(
  'cart_payment_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('cartpaycol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    cartId: text().notNull(),
    paymentCollectionId: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_cart_payment_collection').on(table.cartId, table.paymentCollectionId)],
)

export type CartPaymentCollection = typeof cartPaymentCollectionTable.$inferSelect
export type CreateCartPaymentCollection = typeof cartPaymentCollectionTable.$inferInsert
