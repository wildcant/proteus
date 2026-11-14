import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productOptionBucketTable } from './product-option-bucket.js'
import { productOptionValueTable } from './product-option-value.js'

/**
 * Puts an option value in a filter bucket. A value joins every bucket holding one of its words, so
 * "Black and White" is in Black and in White. Written when the value or the buckets are written.
 *
 * A single prefixed `id` rather than a composite key: the soft-delete walker refuses composites.
 */
export const productOptionValueBucketTable = pgTable(
  'product_option_value_bucket',
  {
    id: text().primaryKey().default(sql`CONCAT('optvbk_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    valueId: text()
      .notNull()
      .references(() => productOptionValueTable.id, { onDelete: 'cascade' }),
    bucketId: text()
      .notNull()
      .references(() => productOptionBucketTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_option_value_bucket_value_bucket').on(table.valueId, table.bucketId),
    liveIndex('idx_product_option_value_bucket_bucket_id').on(table.bucketId),
  ],
)

export type ProductOptionValueBucket = typeof productOptionValueBucketTable.$inferSelect
