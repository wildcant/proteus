import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'
import { productCategoryTable } from './product-category.js'

/**
 * Puts a product in a Category. Both ends cascade, so soft-deleting either the product or the
 * Category hides the row through the derived cascade, and restoring it brings the row back.
 *
 * A single prefixed `id` rather than a composite key: the soft-delete walker refuses composites.
 */
export const productProductCategoryTable = pgTable(
  'product_product_category',
  {
    id: text().primaryKey().default(sql`CONCAT('ppcat_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    categoryId: text()
      .notNull()
      .references(() => productCategoryTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_product_category_product_category').on(table.productId, table.categoryId),
    liveIndex('idx_product_product_category_category_id').on(table.categoryId),
  ],
)
