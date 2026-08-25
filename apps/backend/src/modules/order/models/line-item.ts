import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { orderTable } from './order.js'

export const orderLineItemTable = pgTable(
  'order_line_item',
  {
    id: text().primaryKey().default(sql`CONCAT('ordli_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    orderId: text()
      .notNull()
      .references(() => orderTable.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    subtitle: text(),
    thumbnail: text(),
    quantity: integer().notNull(),
    unitPrice: bignum().notNull(),
    compareAtUnitPrice: bignum(),
    variantId: text(),
    productId: text(),
    productTitle: text(),
    productDescription: text(),
    productSubtitle: text(),
    productType: text(),
    productHandle: text(),
    variantSku: text(),
    variantBarcode: text(),
    variantTitle: text(),
    variantOptionValues: text(),
    requiresShipping: boolean().default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_order_line_item_order_id').on(table.orderId),
    liveIndex('idx_order_line_item_variant_id', sql`variant_id IS NOT NULL`).on(table.variantId),
    liveIndex('idx_order_line_item_product_id', sql`product_id IS NOT NULL`).on(table.productId),
  ],
)

export type OrderLineItem = typeof orderLineItemTable.$inferSelect
export type CreateOrderLineItem = typeof orderLineItemTable.$inferInsert
