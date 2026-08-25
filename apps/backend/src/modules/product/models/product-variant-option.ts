import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productProductOptionValueTable } from './product-product-option-value.js'
import { productVariantTable } from './product-variant.js'

/**
 * Assigns a variant the option value it carries — "this variant is size M". Without it a
 * variant's identity lives only in its title string and the storefront cannot render pickers.
 *
 * It points at the **product's** value rather than the global one, which is what lets dropping an
 * option from a product, or a value from an option on a product, reach these rows. Before the
 * pivot the reference ran to the global value, so both left every variant still claiming a value
 * its product no longer offered.
 *
 * TODO(product-options): two rules have no enforcement here yet, and both need a column this table
 * deliberately does not carry right now — see the TODO in
 * `.scratch/soft-delete-cascade/issues/06-layered-product-option-schema.md`.
 *
 *   - **I1**, one value per option per variant. It needs a denormalised `product_product_option_id`
 *     to index on, because the option is two hops away and Postgres cannot index across a join —
 *     and then a composite foreign key to keep that column honest.
 *   - **I5**, a variant only using options its own product offers. It needs a denormalised
 *     `product_id` and composite keys tying the variant, the option and the product together.
 *
 * What is left below is the minimum that still carries every deletion rule: a variant owns its
 * option values, and a product's value owns the rows that name it.
 */
export const productVariantOptionTable = pgTable(
  'product_variant_option',
  {
    id: text().primaryKey().default(sql`CONCAT('pvopt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text()
      .notNull()
      .references(() => productVariantTable.id, { onDelete: 'cascade' }),
    productProductOptionValueId: text()
      .notNull()
      .references(() => productProductOptionValueTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_variant_option_variant_id').on(table.variantId),
    liveIndex('idx_product_variant_option_product_product_option_value_id').on(table.productProductOptionValueId),
    // A variant carries a given value at most once. Weaker than I1, which is about the *option*:
    // this still permits a variant holding both S and M until the denormalised option comes back.
    liveUniqueIndex('idx_product_variant_option_variant_value').on(table.variantId, table.productProductOptionValueId),
  ],
)

export type ProductVariantOption = typeof productVariantOptionTable.$inferSelect
export type CreateProductVariantOption = typeof productVariantOptionTable.$inferInsert
