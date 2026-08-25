import { sql } from 'drizzle-orm'
import { boolean, integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { serviceZoneTable } from './service-zone.js'
import { shippingOptionTypeTable } from './shipping-option-type.js'
import { shippingProfileTable } from './shipping-profile.js'

export const shippingOptionTable = pgTable(
  'shipping_option',
  {
    id: text().primaryKey().default(sql`CONCAT('so_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    priceType: text().notNull(),
    amount: integer(),
    serviceZoneId: text()
      .notNull()
      .references(() => serviceZoneTable.id),
    shippingProfileId: text()
      .notNull()
      .references(() => shippingProfileTable.id),
    shippingOptionTypeId: text().references(() => shippingOptionTypeTable.id),
    providerId: text().notNull(),
    data: jsonb(),
    metadata: text(),
    isEnabled: boolean().default(true).notNull(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_shipping_option_service_zone_id').on(table.serviceZoneId),
    liveIndex('idx_shipping_option_provider_id').on(table.providerId),
    liveIndex('idx_shipping_option_profile_id').on(table.shippingProfileId),
  ],
)

export type ShippingOption = typeof shippingOptionTable.$inferSelect
export type CreateShippingOption = typeof shippingOptionTable.$inferInsert
