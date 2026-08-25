import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { fulfillmentTable } from './fulfillment.js'

export const fulfillmentAddressTable = pgTable(
  'fulfillment_address',
  {
    id: text().primaryKey().default(sql`CONCAT('fuladdr_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    fulfillmentId: text()
      .notNull()
      .references(() => fulfillmentTable.id, { onDelete: 'cascade' }),
    company: text(),
    firstName: text(),
    lastName: text(),
    address1: text('address_1'),
    address2: text('address_2'),
    city: text(),
    countryCode: text(),
    province: text(),
    postalCode: text(),
    phone: text(),
    metadata: text(),
    ...timestamps,
  },
  (table) => [liveIndex('idx_fulfillment_address_fulfillment_id').on(table.fulfillmentId)],
)

export type FulfillmentAddress = typeof fulfillmentAddressTable.$inferSelect
export type CreateFulfillmentAddress = typeof fulfillmentAddressTable.$inferInsert
