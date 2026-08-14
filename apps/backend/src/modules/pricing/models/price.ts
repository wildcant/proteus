import { sql } from 'drizzle-orm'
import { index, pgTable, text } from 'drizzle-orm/pg-core'
import { bignum } from '../../../core/db/bignum.js'
import { timestamps } from '../../../core/db/columns.js'
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
    index('idx_price_price_set_id').on(table.priceSetId).where(sql`deleted_at IS NULL`),
    index('idx_price_currency_code').on(table.currencyCode).where(sql`deleted_at IS NULL`),
  ],
)

export type Price = typeof priceTable.$inferSelect
export type CreatePrice = typeof priceTable.$inferInsert
