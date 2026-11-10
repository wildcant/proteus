import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

/** The one label naming what a product is ("T-shirt", "Sneakers"). Snapshotted as text onto line items. */
export const productTypeTable = pgTable(
  'product_type',
  {
    id: text().primaryKey().default(sql`CONCAT('ptyp_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    /** Stored as sent: uniqueness is exact and case-sensitive. */
    value: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_product_type_value').on(table.value)],
)
