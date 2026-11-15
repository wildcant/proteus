import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveUniqueIndex } from '../../core/db/indexes.js'

export const orderPaymentCollectionTable = pgTable(
  'order_payment_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('ordpaycol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text().notNull(),
    paymentCollectionId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    /** One payment collection per Order, every recorded payment a capture of part of it. Enforced
     *  here because two first payments recorded at once each read "no collection yet" before
     *  either writes; only the database can decide which one the Order keeps. */
    liveUniqueIndex('idx_order_payment_collection_order_id').on(table.orderId),
  ],
)

export type OrderPaymentCollection = typeof orderPaymentCollectionTable.$inferSelect
export type CreateOrderPaymentCollection = typeof orderPaymentCollectionTable.$inferInsert
