import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productOptionValueTable } from './product-option-value.js'
import { productProductOptionTable } from './product-product-option.js'

/**
 * Specifies which option values are available for a given product-option link.
 * Not all values of an option need to be used on every product — e.g. a
 * "Color" option may have Red/Blue/Green globally, but a specific product
 * might only offer Red and Blue.
 *
 * A row here is also what makes the global value un-removable: `option_value_id` restricts, so
 * "delete Red" is refused while any product still sells anything red, and the shopkeeper is told
 * to unlink it first. Variants no longer guard the global value themselves — they guard the row
 * below them, and this row guards the global one.
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
      .references(() => productOptionValueTable.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_product_option_value_product_product_option_id').on(table.productProductOptionId),
    liveIndex('idx_product_product_option_value_option_value_id').on(table.optionValueId),
    liveUniqueIndex('idx_product_product_option_value_value_once_per_option').on(
      table.productProductOptionId,
      table.optionValueId,
    ),
  ],
)

export type ProductProductOptionValue = typeof productProductOptionValueTable.$inferSelect
export type CreateProductProductOptionValue = typeof productProductOptionValueTable.$inferInsert
