import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const regionTable = pgTable('region', {
  id: text().primaryKey().default(sql`CONCAT('reg_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  name: text().notNull(),
  /** ISO 4217, lowercased. Every price and every payment inside the region settles in it. */
  currencyCode: text().notNull(),
  metadata: text(),
  ...timestamps,
})

export type Region = typeof regionTable.$inferSelect
export type CreateRegion = typeof regionTable.$inferInsert
