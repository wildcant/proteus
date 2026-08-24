import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { inventoryItemTable } from './inventory-item.js'

export const inventoryLevelTable = pgTable(
  'inventory_level',
  {
    id: text().primaryKey().default(sql`CONCAT('ilev_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    inventoryItemId: text()
      .notNull()
      .references(() => inventoryItemTable.id, { onDelete: 'cascade' }),
    locationId: text().notNull(),
    stockedQuantity: integer().notNull().default(0),
    reservedQuantity: integer().notNull().default(0),
    incomingQuantity: integer().notNull().default(0),
    metadata: text(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_inventory_level_item_location').on(table.inventoryItemId, table.locationId),
    liveIndex('idx_inventory_level_inventory_item_id').on(table.inventoryItemId),
    liveIndex('idx_inventory_level_location_id').on(table.locationId),
  ],
)

export type InventoryLevel = typeof inventoryLevelTable.$inferSelect
export type CreateInventoryLevel = typeof inventoryLevelTable.$inferInsert
