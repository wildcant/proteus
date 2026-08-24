import { sql } from 'drizzle-orm'
import { boolean, doublePrecision, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'

export const productVariantTable = pgTable(
  'product_variant',
  {
    id: text().primaryKey().default(sql`CONCAT('variant_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    thumbnail: text(),
    sku: text(),
    barcode: text(),
    ean: text(),
    upc: text(),
    allowBackorder: boolean().default(false).notNull(),
    manageInventory: boolean().default(true).notNull(),
    hsCode: text(),
    originCountry: text(),
    midCode: text(),
    material: text(),
    weight: doublePrecision(),
    length: doublePrecision(),
    height: doublePrecision(),
    width: doublePrecision(),
    variantRank: integer().default(0),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_variant_product_id').on(table.productId),
    liveUniqueIndex('idx_product_variant_sku').on(table.sku),
    liveUniqueIndex('idx_product_variant_barcode').on(table.barcode),
    liveUniqueIndex('idx_product_variant_ean').on(table.ean),
    liveUniqueIndex('idx_product_variant_upc').on(table.upc),
  ],
)

export type ProductVariant = typeof productVariantTable.$inferSelect
export type CreateProductVariant = typeof productVariantTable.$inferInsert
