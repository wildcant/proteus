import { sql } from 'drizzle-orm'
import { boolean, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

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
    liveUniqueIndex('idx_customer_unique_email_has_account_true', sql`has_account = true`).on(table.email),
    liveUniqueIndex('idx_customer_unique_email_has_account_false', sql`has_account = false`).on(table.email),
  ],
)

export type Customer = typeof customerTable.$inferSelect
export type CreateCustomer = typeof customerTable.$inferInsert
