import { timestamps } from '@core/db/columns.js'
import { liveIndex } from '@core/db/indexes.js'
import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'

export const fixtureShippingRateTable = pgTable(
  'fixture_shipping_rates',
  {
    id: text().primaryKey().default(sql`CONCAT('fsrate_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    city: text().notNull(),
    baseAmount: integer().notNull(),
    perItemAmount: integer().notNull(),
    deliveryDays: integer().notNull(),
    ...timestamps,
  },
  (table) => [liveIndex('fixture_shipping_rates_city_idx').on(table.city)],
)
