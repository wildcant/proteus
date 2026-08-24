import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productImageTable } from './product-image.js'
import { productVariantTable } from './product-variant.js'

export const productVariantImageTable = pgTable(
  'product_variant_image',
  {
    id: text().primaryKey().default(sql`CONCAT('pvimg_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text()
      .notNull()
      .references(() => productVariantTable.id, { onDelete: 'cascade' }),
    imageId: text()
      .notNull()
      .references(() => productImageTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_variant_image_variant_id').on(table.variantId),
    liveIndex('idx_product_variant_image_image_id').on(table.imageId),
    liveUniqueIndex('idx_product_variant_image_variant_id_image_id').on(table.variantId, table.imageId),
  ],
)

export type ProductVariantImage = typeof productVariantImageTable.$inferSelect
export type CreateProductVariantImage = typeof productVariantImageTable.$inferInsert
