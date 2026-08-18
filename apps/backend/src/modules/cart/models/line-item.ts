import { sql } from 'drizzle-orm'
import { boolean, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
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
    index('idx_cart_line_item_cart_id').on(table.cartId).where(sql`deleted_at IS NULL`),
    index('idx_cart_line_item_variant_id')
      .on(table.variantId)
      .where(sql`deleted_at IS NULL AND variant_id IS NOT NULL`),
    index('idx_cart_line_item_product_id')
      .on(table.productId)
      .where(sql`deleted_at IS NULL AND product_id IS NOT NULL`),
  ],
)

export type CartLineItem = typeof cartLineItemTable.$inferSelect
export type CreateCartLineItem = typeof cartLineItemTable.$inferInsert
