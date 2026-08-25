import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productOptionTable } from './product-option.js'

export const productOptionValueTable = pgTable(
  'product_option_value',
  {
    id: text().primaryKey().default(sql`CONCAT('optval_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    optionId: text()
      .notNull()
      .references(() => productOptionTable.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    rank: integer().default(0),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_option_value_option_id').on(table.optionId),
    liveUniqueIndex('idx_product_option_value_option_id_value').on(table.optionId, table.value),
  ],
)

export type ProductOptionValue = typeof productOptionValueTable.$inferSelect
export type CreateProductOptionValue = typeof productOptionValueTable.$inferInsert
