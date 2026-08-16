import { sql } from 'drizzle-orm'
import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { productTable } from './product.js'
import { productOptionTable } from './product-option.js'

/**
 * Links a product to a global product option. Options are standalone entities
 * (e.g. "Color", "Size") that can be shared across multiple products. This
 * join table controls which options are available on each product.
 */
export const productProductOptionTable = pgTable(
  'product_product_option',
  {
    id: text().primaryKey().default(sql`CONCAT('prodopt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    optionId: text()
      .notNull()
      .references(() => productOptionTable.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    index('idx_product_product_option_product_id').on(table.productId),
    index('idx_product_product_option_option_id').on(table.optionId),
    uniqueIndex('idx_product_product_option_product_option')
      .on(table.productId, table.optionId)
      .where(sql`deleted_at IS NULL`),
  ],
)

export type ProductProductOption = typeof productProductOptionTable.$inferSelect
export type CreateProductProductOption = typeof productProductOptionTable.$inferInsert
