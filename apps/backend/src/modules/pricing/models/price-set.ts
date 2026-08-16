import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const priceSetTable = pgTable('price_set', {
  id: text().primaryKey().default(sql`CONCAT('pset_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  ...timestamps,
})

export type PriceSet = typeof priceSetTable.$inferSelect
export type CreatePriceSet = typeof priceSetTable.$inferInsert
