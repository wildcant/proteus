import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
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
    index('idx_order_line_item_order_id').on(table.orderId).where(sql`deleted_at IS NULL`),
    index('idx_order_line_item_variant_id')
      .on(table.variantId)
      .where(sql`deleted_at IS NULL AND variant_id IS NOT NULL`),
    index('idx_order_line_item_product_id')
      .on(table.productId)
      .where(sql`deleted_at IS NULL AND product_id IS NOT NULL`),
  ],
)

export type OrderLineItem = typeof orderLineItemTable.$inferSelect
export type CreateOrderLineItem = typeof orderLineItemTable.$inferInsert
