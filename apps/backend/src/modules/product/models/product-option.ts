import { sql } from 'drizzle-orm'
import { pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const productOptionTable = pgTable(
  'product_option',
  {
    id: text().primaryKey().default(sql`CONCAT('opt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    metadata: text(),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_product_option_title').on(table.title).where(sql`deleted_at IS NULL`)],
)

export type ProductOption = typeof productOptionTable.$inferSelect
export type CreateProductOption = typeof productOptionTable.$inferInsert
