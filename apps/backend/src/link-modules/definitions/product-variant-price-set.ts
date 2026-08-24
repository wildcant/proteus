import { relations, sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../core/db/indexes.js'
import { priceSetTable, productVariantTable } from '../modules-definitions.js'

export const productVariantPriceSetTable = pgTable(
  'product_variant_price_set',
  {
    id: text().primaryKey().default(sql`CONCAT('pvps_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text().notNull(),
    priceSetId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_pvps_variant_price_set').on(table.variantId, table.priceSetId),
    liveIndex('idx_pvps_variant_id').on(table.variantId),
    liveIndex('idx_pvps_price_set_id').on(table.priceSetId),
  ],
)

export const productVariantPriceSetRelations = relations(productVariantPriceSetTable, ({ one }) => ({
  variant: one(productVariantTable, {
    fields: [productVariantPriceSetTable.variantId],
    references: [productVariantTable.id],
  }),
  priceSet: one(priceSetTable, {
    fields: [productVariantPriceSetTable.priceSetId],
    references: [priceSetTable.id],
  }),
}))

export type ProductVariantPriceSet = typeof productVariantPriceSetTable.$inferSelect
export type CreateProductVariantPriceSet = typeof productVariantPriceSetTable.$inferInsert
