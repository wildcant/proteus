import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { cartTable } from './cart.js'

export const cartLineItemTable = pgTable(
  'cart_line_item',
  {
    id: text().primaryKey().default(sql`CONCAT('cali_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    cartId: text()
      .notNull()
      .references(() => cartTable.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    subtitle: text(),
    thumbnail: text(),
    quantity: integer().notNull(),
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
    isDiscountable: boolean().default(true).notNull(),
    isGiftcard: boolean().default(false).notNull(),
    isTaxInclusive: boolean().default(false).notNull(),
    compareAtUnitPrice: bignum(),
    unitPrice: bignum().notNull(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_cart_line_item_cart_id').on(table.cartId),
    liveIndex('idx_cart_line_item_variant_id', sql`variant_id IS NOT NULL`).on(table.variantId),
    liveIndex('idx_cart_line_item_product_id', sql`product_id IS NOT NULL`).on(table.productId),
  ],
)

export type CartLineItem = typeof cartLineItemTable.$inferSelect
export type CreateCartLineItem = typeof cartLineItemTable.$inferInsert
