import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import { productTable } from './product.js'

export const productImageTable = pgTable(
  'product_image',
  {
    id: text().primaryKey().default(sql`CONCAT('img_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    productId: text()
      .notNull()
      .references(() => productTable.id, { onDelete: 'cascade' }),
    url: text().notNull(),
    rank: integer().default(0).notNull(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    liveIndex('idx_product_image_product_id').on(table.productId),
    liveIndex('idx_product_image_url').on(table.url),
    liveIndex('idx_product_image_rank_product_id').on(table.rank, table.productId),
  ],
)

export type ProductImage = typeof productImageTable.$inferSelect
export type CreateProductImage = typeof productImageTable.$inferInsert
