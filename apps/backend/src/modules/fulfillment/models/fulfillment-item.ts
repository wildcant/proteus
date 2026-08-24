import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { fulfillmentTable } from './fulfillment.js'

export const fulfillmentItemTable = pgTable(
  'fulfillment_item',
  {
    id: text().primaryKey().default(sql`CONCAT('fulit_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    fulfillmentId: text()
      .notNull()
      .references(() => fulfillmentTable.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    quantity: integer().notNull(),
    sku: text(),
    barcode: text(),
    lineItemId: text(),
    inventoryItemId: text(),
    metadata: text(),
    ...timestamps,
  },
  (table) => [liveIndex('idx_fulfillment_item_fulfillment_id').on(table.fulfillmentId)],
)

export type FulfillmentItem = typeof fulfillmentItemTable.$inferSelect
export type CreateFulfillmentItem = typeof fulfillmentItemTable.$inferInsert
