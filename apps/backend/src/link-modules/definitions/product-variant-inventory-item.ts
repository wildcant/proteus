import { relations, sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../core/db/indexes.js'
import { inventoryItemTable, productVariantTable } from '../modules-definitions.js'

export const productVariantInventoryItemTable = pgTable(
  'product_variant_inventory_item',
  {
    id: text().primaryKey().default(sql`CONCAT('pvitem_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    variantId: text().notNull(),
    inventoryItemId: text().notNull(),
    requiredQuantity: integer().notNull().default(1),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_pvitem_variant_inventory').on(table.variantId, table.inventoryItemId),
    liveIndex('idx_pvitem_variant_id').on(table.variantId),
    liveIndex('idx_pvitem_inventory_item_id').on(table.inventoryItemId),
  ],
)

export const productVariantInventoryItemRelations = relations(productVariantInventoryItemTable, ({ one }) => ({
  variant: one(productVariantTable, {
    fields: [productVariantInventoryItemTable.variantId],
    references: [productVariantTable.id],
  }),
  inventoryItem: one(inventoryItemTable, {
    fields: [productVariantInventoryItemTable.inventoryItemId],
    references: [inventoryItemTable.id],
  }),
}))

export type ProductVariantInventoryItem = typeof productVariantInventoryItemTable.$inferSelect
export type CreateProductVariantInventoryItem = typeof productVariantInventoryItemTable.$inferInsert
