import { sql } from 'drizzle-orm'
import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { productOptionValueTable } from './product-option-value.js'
import { productProductOptionTable } from './product-product-option.js'

/**
 * Specifies which option values are available for a given product-option link.
 * Not all values of an option need to be used on every product — e.g. a
 * "Color" option may have Red/Blue/Green globally, but a specific product
 * might only offer Red and Blue.
 */
export const productProductOptionValueTable = pgTable(
  'product_product_option_value',
  {
    id: text().primaryKey().default(sql`CONCAT('prodoptval_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productProductOptionId: text()
      .notNull()
      .references(() => productProductOptionTable.id, { onDelete: 'cascade' }),
    optionValueId: text()
      .notNull()
      .references(() => productOptionValueTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    index('idx_product_product_option_value_ppo_id').on(table.productProductOptionId),
    index('idx_product_product_option_value_ov_id').on(table.optionValueId),
    uniqueIndex('idx_product_product_option_value_ppo_ov')
      .on(table.productProductOptionId, table.optionValueId)
      .where(sql`deleted_at IS NULL`),
  ],
)

export type ProductProductOptionValue = typeof productProductOptionValueTable.$inferSelect
export type CreateProductProductOptionValue = typeof productProductOptionValueTable.$inferInsert
