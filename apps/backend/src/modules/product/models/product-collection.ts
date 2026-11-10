import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

/** A hand-picked merchandising group ("Summer 2026"). A product can sit in several (ADR 0032). */
export const productCollectionTable = pgTable(
  'product_collection',
  {
    id: text().primaryKey().default(sql`CONCAT('pcol_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    handle: text().notNull(),
    /** A URL from `POST /admin/uploads`, as `product.thumbnail` is. */
    thumbnail: text(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_product_collection_handle').on(table.handle)],
)
