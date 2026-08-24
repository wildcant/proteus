import { sql } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { shippingOptionTable } from './shipping-option.js'

export const fulfillmentTable = pgTable(
  'fulfillment',
  {
    id: text().primaryKey().default(sql`CONCAT('ful_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    locationId: text(),
    providerId: text().notNull(),
    shippingOptionId: text().references(() => shippingOptionTable.id),
    data: jsonb(),
    requiresShipping: boolean().default(true).notNull(),
    packedAt: timestamp({ withTimezone: true }),
    shippedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    canceledAt: timestamp({ withTimezone: true }),
    metadata: text(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_fulfillment_provider_id').on(table.providerId),
    liveIndex('idx_fulfillment_shipping_option_id', sql`shipping_option_id IS NOT NULL`).on(table.shippingOptionId),
  ],
)

export type Fulfillment = typeof fulfillmentTable.$inferSelect
export type CreateFulfillment = typeof fulfillmentTable.$inferInsert
