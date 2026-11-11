import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'
import { productMetafieldDefinitionTable } from './product-metafield-definition.js'

/**
 * One value of a product's metafield: a list metafield holding `[men, unisex]` is two rows, so rule
 * matching and value counts stay plain lookups. Both ends cascade, so deleting the product or the
 * definition hides its values.
 */
export const productMetafieldTable = pgTable(
  'product_metafield',
  {
    id: text().primaryKey().default(sql`CONCAT('pmf_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    definitionId: text()
      .notNull()
      .references(() => productMetafieldDefinitionTable.id, { onDelete: 'cascade' }),
    value: text().notNull(),
    /** Order within the product's list, as it was written. */
    position: integer().default(0).notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_metafield_product_definition_value').on(
      table.productId,
      table.definitionId,
      table.value,
    ),
    liveIndex('idx_product_metafield_definition_value').on(table.definitionId, table.value),
  ],
)
