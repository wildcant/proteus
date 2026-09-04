import { sql } from 'drizzle-orm'
import { boolean, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { storeTable } from './store.js'

export const storeCurrencyTable = pgTable(
  'store_currency',
  {
    id: text().primaryKey().default(sql`CONCAT('stocur_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    storeId: text()
      .notNull()
      .references(() => storeTable.id, { onDelete: 'cascade' }),
    /** ISO 4217, lowercased. */
    currencyCode: text().notNull(),
    isDefault: boolean().notNull().default(false),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_store_currency_store_id_currency_code').on(table.storeId, table.currencyCode),
    liveIndex('idx_store_currency_store_id').on(table.storeId),
  ],
)

export type StoreCurrency = typeof storeCurrencyTable.$inferSelect
export type CreateStoreCurrency = typeof storeCurrencyTable.$inferInsert
