import { sql } from 'drizzle-orm'
import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

export const inventoryItemTable = pgTable(
  'inventory_item',
  {
    id: text().primaryKey().default(sql`CONCAT('iitem_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    sku: text(),
    originCountry: text(),
    hsCode: text(),
    midCode: text(),
    material: text(),
    weight: integer(),
    length: integer(),
    height: integer(),
    width: integer(),
    requiresShipping: boolean().default(true).notNull(),
    description: text(),
    title: text(),
    thumbnail: text(),
    metadata: text(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_inventory_item_sku').on(table.sku)],
)

export type InventoryItem = typeof inventoryItemTable.$inferSelect
export type CreateInventoryItem = typeof inventoryItemTable.$inferInsert
