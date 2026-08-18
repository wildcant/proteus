import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

export const orderAddressTable = pgTable('order_address', {
  id: text().primaryKey().default(sql`CONCAT('ordaddr_', REPLACE(gen_random_uuid()::text, '-', ''))`),
  customerId: text(),
  company: text(),
  firstName: text(),
  lastName: text(),
  address1: text('address_1'),
  address2: text('address_2'),
  city: text(),
  countryCode: text(),
  province: text(),
  postalCode: text(),
  phone: text(),
  ...timestamps,
})

export type OrderAddress = typeof orderAddressTable.$inferSelect
export type CreateOrderAddress = typeof orderAddressTable.$inferInsert
