import { relations, sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../core/db/indexes.js'
import { paymentProviderTable, regionTable } from '../modules-definitions.js'

/**
 * Which payment providers a region offers. Many-to-many: one provider serves several regions and
 * one region offers several providers, so neither table can carry a column for the other.
 */
export const regionPaymentProviderTable = pgTable(
  'region_payment_provider',
  {
    id: text().primaryKey().default(sql`CONCAT('regpp_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    regionId: text().notNull(),
    paymentProviderId: text().notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_regpp_region_payment_provider').on(table.regionId, table.paymentProviderId),
    liveIndex('idx_regpp_region_id').on(table.regionId),
    liveIndex('idx_regpp_payment_provider_id').on(table.paymentProviderId),
  ],
)

export const regionPaymentProviderRelations = relations(regionPaymentProviderTable, ({ one }) => ({
  region: one(regionTable, {
    fields: [regionPaymentProviderTable.regionId],
    references: [regionTable.id],
  }),
  paymentProvider: one(paymentProviderTable, {
    fields: [regionPaymentProviderTable.paymentProviderId],
    references: [paymentProviderTable.id],
  }),
}))

export type RegionPaymentProvider = typeof regionPaymentProviderTable.$inferSelect
export type CreateRegionPaymentProvider = typeof regionPaymentProviderTable.$inferInsert
