import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { regionTable } from './region.js'

export const countryTable = pgTable(
  'country',
  {
    /**
     * The ISO 3166-1 alpha-2 code, lowercased.
     *
     * This table is static reference data — the whole ISO list is seeded and never authored — so
     * the code already identifies the row and a generated id would be a second key to keep in
     * step with it. Everything that names a country (a geo zone, a shipping address, a URL
     * segment) names it by this code.
     */
    id: text().primaryKey(),
    iso3: text().notNull(),
    numericCode: text().notNull(),
    name: text().notNull(),
    displayName: text().notNull(),
    /**
     * The region that sells to this country, or null. Assigning one is what makes the country
     * sellable: the ISO list ships whole, and the store opts countries into it one at a time.
     */
    regionId: text().references(() => regionTable.id, { onDelete: 'set null' }),
    /**
     * BCP 47 tag, e.g. `es-CO`. One stored field doing three jobs: the URL segment, the document
     * language attribute, and the tag every number and date formatter is given.
     *
     * Stored rather than derived from the country code, because the derivation is wrong.
     * `en-CO` formats a Colombian peso as `COP 1,234` — a three-letter code and US separators —
     * while `es-CO` gives `$ 1.234`. Set exactly when `regionId` is; the seed asserts it.
     */
    localeCode: text(),
    ...timestamps,
  },
  (table) => [
    // The country's own uniqueness is its primary key. This one says the other half: a country
    // cannot be listed twice under one region.
    liveUniqueIndex('idx_country_region_id_iso2').on(table.regionId, table.id),
    liveIndex('idx_country_region_id').on(table.regionId),
  ],
)

export type Country = typeof countryTable.$inferSelect
export type CreateCountry = typeof countryTable.$inferInsert
