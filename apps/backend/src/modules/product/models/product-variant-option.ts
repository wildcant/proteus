import { sql } from 'drizzle-orm'
import { index, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { productOptionTable } from './product-option.js'
import { productOptionValueTable } from './product-option-value.js'
import { productVariantTable } from './product-variant.js'

/**
 * Assigns a variant the option value it carries — "this variant is size M". Without it a
 * variant's identity lives only in its title string and the storefront cannot render pickers.
 *
 * `optionId` is denormalised from `product_option_value.option_id` so that "one value per option
 * per variant" — the invariant every generic option renderer rests on — is a database constraint
 * rather than a service convention. It cannot drift: option values are never re-parented.
 */
export const productVariantOptionTable = pgTable(
  'product_variant_option',
  {
    id: text().primaryKey().default(sql`CONCAT('pvopt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text()
      .notNull()
      .references(() => productVariantTable.id, { onDelete: 'cascade' }),
    optionId: text()
      .notNull()
      .references(() => productOptionTable.id, { onDelete: 'cascade' }),
    optionValueId: text()
      .notNull()
      .references(() => productOptionValueTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    index('idx_product_variant_option_variant_id').on(table.variantId),
    index('idx_product_variant_option_option_id').on(table.optionId),
    index('idx_product_variant_option_option_value_id').on(table.optionValueId),
    uniqueIndex('idx_product_variant_option_variant_option')
      .on(table.variantId, table.optionId)
      .where(sql`deleted_at IS NULL`),
    uniqueIndex('idx_product_variant_option_variant_option_value')
      .on(table.variantId, table.optionValueId)
      .where(sql`deleted_at IS NULL`),
  ],
)

export type ProductVariantOption = typeof productVariantOptionTable.$inferSelect
export type CreateProductVariantOption = typeof productVariantOptionTable.$inferInsert
