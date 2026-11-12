import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'
import type { ProductMetafieldType } from '../../../core/types/product/common.js'

/**
 * A named product field ("Género", key `genero`), the shape Shopify calls a metafield definition.
 * The structure file declares them under `campos`; rules and product writes name them by key.
 */
export const productMetafieldDefinitionTable = pgTable(
  'product_metafield_definition',
  {
    id: text().primaryKey().default(sql`CONCAT('pmfd_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    /** Shopify's grouping of keys. The structure file writes `custom`, the namespace of a merchant's own fields. */
    namespace: text().default('custom').notNull(),
    key: text().notNull(),
    name: text().notNull(),
    type: text().$type<ProductMetafieldType>().default('list.single_line_text_field').notNull(),
    /** Offered as a storefront filter on the product lists, as Shopify's per-definition "filter" switch. */
    filterable: boolean().default(false).notNull(),
    /** Place in the structure file's `campos`, which is the order the storefront's filters show in. */
    rank: integer().default(0).notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_product_metafield_definition_namespace_key').on(table.namespace, table.key)],
)
