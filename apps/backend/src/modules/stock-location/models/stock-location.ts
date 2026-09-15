import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

/**
 * A place the shop holds stock. The shop keeps exactly one, but an Inventory Level and a
 * Reservation each name the location they belong to, so a second one adds rows rather than
 * changing what the words mean.
 *
 * Medusa's `stock_location` also carries `address_id` — pointing at a `stock_location_address`
 * table — and `metadata`. Neither is built: nothing here records a ship-from address, nothing
 * would read one, and `address_id` is nullable in Medusa anyway. Under the naming rule that is the
 * intended outcome, because a schema diff against Medusa then shows which pieces are missing
 * rather than which have been renamed. The shipping work adds both, under Medusa's names.
 */
export const stockLocationTable = pgTable('stock_location', {
  id: text().primaryKey().default(sql`CONCAT('sloc_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  name: text().notNull(),
  ...timestamps,
})

export type StockLocation = typeof stockLocationTable.$inferSelect
export type CreateStockLocation = typeof stockLocationTable.$inferInsert
