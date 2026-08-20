import { sql } from 'drizzle-orm'
import { boolean, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const customerStatusEnum = pgEnum('customer_status', ['active', 'inactive'])

export const customerTable = pgTable(
  'customer',
  {
    id: text().primaryKey().default(sql`CONCAT('cus_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    hasAccount: boolean().default(false).notNull(),
    firstName: text(),
    lastName: text(),
    email: text().notNull(),
    status: customerStatusEnum().default('active').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idx_customer_unique_email_has_account_true')
      .on(table.email)
      .where(sql`has_account = true AND deleted_at IS NULL`),
    uniqueIndex('idx_customer_unique_email_has_account_false')
      .on(table.email)
      .where(sql`has_account = false AND deleted_at IS NULL`),
  ],
)

export type Customer = typeof customerTable.$inferSelect
export type CreateCustomer = typeof customerTable.$inferInsert
