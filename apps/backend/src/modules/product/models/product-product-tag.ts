import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'
import { productTagTable } from './product-tag.js'

/**
 * Puts a Tag on a product. Both ends cascade, so soft-deleting either the product or the Tag hides
 * the row through the derived cascade, and restoring it brings the row back.
 *
 * A single prefixed `id` rather than a composite key: the soft-delete walker refuses composites.
 */
export const productProductTagTable = pgTable(
  'product_product_tag',
  {
    id: text().primaryKey().default(sql`CONCAT('pptag_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    tagId: text()
      .notNull()
      .references(() => productTagTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_product_tag_product_tag').on(table.productId, table.tagId),
    liveIndex('idx_product_product_tag_tag_id').on(table.tagId),
  ],
)
