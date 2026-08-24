import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'

export const fulfillmentSetTable = pgTable(
  'fulfillment_set',
  {
    id: text().primaryKey().default(sql`CONCAT('fuset_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    type: text().notNull(),
    metadata: text(),
    ...timestamps,
  },
  (table) => [liveIndex('idx_fulfillment_set_type').on(table.type)],
)

export type FulfillmentSet = typeof fulfillmentSetTable.$inferSelect
export type CreateFulfillmentSet = typeof fulfillmentSetTable.$inferInsert
