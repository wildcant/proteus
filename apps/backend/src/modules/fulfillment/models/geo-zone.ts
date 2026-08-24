import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { serviceZoneTable } from './service-zone.js'

export const geoZoneTable = pgTable(
  'geo_zone',
  {
    id: text().primaryKey().default(sql`CONCAT('fgz_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    type: text().notNull(),
    countryCode: text().notNull(),
    provinceCode: text(),
    city: text(),
    postalExpression: text(),
    serviceZoneId: text()
      .notNull()
      .references(() => serviceZoneTable.id, { onDelete: 'cascade' }),
    metadata: text(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_geo_zone_service_zone_id').on(table.serviceZoneId),
    liveIndex('idx_geo_zone_country_code').on(table.countryCode),
  ],
)

export type GeoZone = typeof geoZoneTable.$inferSelect
export type CreateGeoZone = typeof geoZoneTable.$inferInsert
