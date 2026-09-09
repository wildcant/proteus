import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const storeTable = pgTable('store', {
  id: text().primaryKey().default(sql`CONCAT('store_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  name: text().notNull(),
  /** Cross-module reference to `region.id`, so no foreign key: the region module owns that table. */
  defaultRegionId: text(),
  metadata: text(),
  ...timestamps,
})

export type Store = typeof storeTable.$inferSelect
export type CreateStore = typeof storeTable.$inferInsert
