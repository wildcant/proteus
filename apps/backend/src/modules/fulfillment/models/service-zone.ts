import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { fulfillmentSetTable } from './fulfillment-set.js'

export const serviceZoneTable = pgTable(
  'service_zone',
  {
    id: text().primaryKey().default(sql`CONCAT('serzo_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    fulfillmentSetId: text()
      .notNull()
      .references(() => fulfillmentSetTable.id, { onDelete: 'cascade' }),
    metadata: text(),
    ...timestamps,
  },
  (table) => [liveIndex('idx_service_zone_fulfillment_set_id').on(table.fulfillmentSetId)],
)

export type ServiceZone = typeof serviceZoneTable.$inferSelect
export type CreateServiceZone = typeof serviceZoneTable.$inferInsert
