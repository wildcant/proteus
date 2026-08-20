import { sql } from 'drizzle-orm'
import { index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { cartTable } from './cart.js'

export const cartCreditLineTable = pgTable(
  'cart_credit_line',
  {
    id: text().primaryKey().default(sql`CONCAT('cacl_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    cartId: text()
      .notNull()
      .references(() => cartTable.id, { onDelete: 'cascade' }),
    reference: text(),
    referenceId: text(),
    amount: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    index('idx_cart_credit_line_cart_id').on(table.cartId).where(sql`deleted_at IS NULL`),
    index('idx_cart_credit_line_reference').on(table.reference, table.referenceId).where(sql`deleted_at IS NULL`),
  ],
)

export type CartCreditLine = typeof cartCreditLineTable.$inferSelect
export type CreateCartCreditLine = typeof cartCreditLineTable.$inferInsert
