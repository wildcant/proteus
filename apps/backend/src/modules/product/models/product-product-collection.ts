import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'
import { productCollectionTable } from './product-collection.js'

/**
 * Puts a product in a Collection. Both ends cascade, so soft-deleting either the product or the
 * Collection hides the row through the derived cascade, and restoring it brings the row back.
 *
 * A single prefixed `id` rather than a composite key: the soft-delete walker refuses composites.
 */
export const productProductCollectionTable = pgTable(
  'product_product_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('ppcol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    collectionId: text()
      .notNull()
      .references(() => productCollectionTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_product_collection_product_collection').on(table.productId, table.collectionId),
    liveIndex('idx_product_product_collection_collection_id').on(table.collectionId),
  ],
)
