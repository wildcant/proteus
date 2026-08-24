import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { priceSetTable } from './price-set.js'

// TODO(pricing): add minQuantity, maxQuantity (bignum, nullable) for quantity tiers
// TODO(pricing): add rulesCount (integer, default 0) when PriceRule is added
// TODO(pricing): add priceListId (text, nullable FK) when PriceList is added

export const priceTable = pgTable(
  'price',
  {
    id: text().primaryKey().default(sql`CONCAT('price_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    currencyCode: text().notNull(),
    amount: bignum().notNull(),
    priceSetId: text()
      .notNull()
      .references(() => priceSetTable.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_price_price_set_id').on(table.priceSetId),
    liveIndex('idx_price_currency_code').on(table.currencyCode),
  ],
)

export type Price = typeof priceTable.$inferSelect
export type CreatePrice = typeof priceTable.$inferInsert
