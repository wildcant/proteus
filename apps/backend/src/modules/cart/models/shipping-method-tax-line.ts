import { sql } from 'drizzle-orm'
import { index, pgTable, real, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { cartShippingMethodTable } from './shipping-method.js'

export const cartShippingMethodTaxLineTable = pgTable(
  'cart_shipping_method_tax_line',
  {
    id: text().primaryKey().default(sql`CONCAT('casmtxl_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    shippingMethodId: text()
      .notNull()
      .references(() => cartShippingMethodTable.id, { onDelete: 'cascade' }),
    code: text().notNull(),
    rate: real().notNull(),
    description: text(),
    providerId: text(),
    taxRateId: text(),
    ...timestamps,
  },
  (table) => [
    index('idx_cart_sm_tax_line_shipping_method_id').on(table.shippingMethodId).where(sql`deleted_at IS NULL`),
    index('idx_cart_sm_tax_line_tax_rate_id')
      .on(table.taxRateId)
      .where(sql`deleted_at IS NULL AND tax_rate_id IS NOT NULL`),
  ],
)

export type CartShippingMethodTaxLine = typeof cartShippingMethodTaxLineTable.$inferSelect
export type CreateCartShippingMethodTaxLine = typeof cartShippingMethodTaxLineTable.$inferInsert
