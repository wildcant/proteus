import { sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const storeTable = pgTable('store', {
  id: text().primaryKey().default(sql`CONCAT('store_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  name: text().notNull(),
  /** Cross-module reference to `region.id`, so no foreign key: the region module owns that table. */
  defaultRegionId: text(),
  /**
   * At or below how many units available a variant counts as running low, or `null` for a shop
   * that does not want the idea at all.
   *
   * One number for both audiences: it is what alerts the shopkeeper and what puts "only N left" in
   * front of the shopper, so the two can never disagree about what low means. Null disables both.
   *
   * Medusa has no low-stock concept and so no column to name this after — it is meant to show up
   * as an addition in a schema comparison rather than as a rename.
   */
  lowStockThreshold: integer(),
  metadata: text(),
  ...timestamps,
})

export type Store = typeof storeTable.$inferSelect
export type CreateStore = typeof storeTable.$inferInsert
