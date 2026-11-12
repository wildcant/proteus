import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

/** A free keyword on products ("organic-cotton", "gold"). Drives the tag filter on product lists. */
export const productTagTable = pgTable(
  'product_tag',
  {
    id: text().primaryKey().default(sql`CONCAT('ptag_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    /** Stored as sent: uniqueness is exact and case-sensitive. */
    value: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_product_tag_value').on(table.value)],
)
