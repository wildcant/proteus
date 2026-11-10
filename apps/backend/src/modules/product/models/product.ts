import { sql } from 'drizzle-orm'
import { boolean, doublePrecision, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'
import { productTypeTable } from './product-type.js'

export const ProductStatus = {
  DRAFT: 'draft',
  PROPOSED: 'proposed',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
} as const

export type ProductStatusType = (typeof ProductStatus)[keyof typeof ProductStatus]

export const productTable = pgTable(
  'product',
  {
    id: text().primaryKey().default(sql`CONCAT('prod_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    handle: text().notNull(),
    subtitle: text(),
    description: text(),
    isGiftcard: boolean().default(false).notNull(),
    status: text().$type<ProductStatusType>().default('draft').notNull(),
    thumbnail: text(),
    weight: doublePrecision(),
    length: doublePrecision(),
    height: doublePrecision(),
    width: doublePrecision(),
    originCountry: text(),
    hsCode: text(),
    midCode: text(),
    material: text(),
    discountable: boolean().default(true).notNull(),
    externalId: text(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    /**
     * The product's Product Type. `set null` keeps it out of the derived soft-delete cascade, so
     * soft-deleting a Type leaves the id in place; reads join live Types only.
     */
    typeId: text().references(() => productTypeTable.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_handle').on(table.handle),
    liveIndex('idx_product_type_id').on(table.typeId),
  ],
)

export type Product = typeof productTable.$inferSelect
export type CreateProduct = typeof productTable.$inferInsert
