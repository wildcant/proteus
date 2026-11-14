import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productOptionTable } from './product-option.js'

/**
 * A group the store filter offers in place of an option's raw values: "Black" for "Black / Red" and
 * "Jet Black". A value joins at write time every bucket holding one of its words
 * (`product_option_value_bucket`), so the filter joins a pivot rather than matching text per query.
 */
export const productOptionBucketTable = pgTable(
  'product_option_bucket',
  {
    id: text().primaryKey().default(sql`CONCAT('optbkt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    optionId: text()
      .notNull()
      .references(() => productOptionTable.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    /** Whatever the storefront draws the bucket's swatch from; Proteus does not read it. `null` draws none. */
    swatch: text(),
    /** The words that put a value in the bucket, lower-cased, matched as whole words. */
    words: text().array().default(sql`'{}'::text[]`).notNull(),
    rank: integer().default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_option_bucket_option_id').on(table.optionId),
    liveUniqueIndex('idx_product_option_bucket_option_id_name').on(table.optionId, table.name),
  ],
)

export type ProductOptionBucket = typeof productOptionBucketTable.$inferSelect
export type CreateProductOptionBucket = typeof productOptionBucketTable.$inferInsert
