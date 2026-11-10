import { sql } from 'drizzle-orm'
import { type AnyPgColumn, boolean, integer, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex, liveUniqueIndex } from '../../../core/db/indexes.js'

/**
 * A node in the merchant's Category tree. `parentId` alone shapes the tree — no materialised path —
 * so subtree and ancestor questions are recursive CTEs.
 *
 * The parent reference is `restrict`, which makes a live child a guard in the derived soft-delete
 * cascade: a Category with children cannot be deleted, so subtrees go leaf-first.
 */
export const productCategoryTable = pgTable(
  'product_category',
  {
    id: text().primaryKey().default(sql`CONCAT('pcat_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    name: text().notNull(),
    /** Shown under the category page heading. */
    description: text().default('').notNull(),
    handle: text().notNull(),
    parentId: text().references((): AnyPgColumn => productCategoryTable.id, { onDelete: 'restrict' }),
    /** Order among siblings. Every write that places a Category renumbers its sibling set 0..n-1. */
    rank: integer().default(0).notNull(),
    /** Shown on the store. */
    isActive: boolean().default(false).notNull(),
    /** Assignable in the admin, never shown on the store. */
    isInternal: boolean().default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    liveUniqueIndex('idx_product_category_handle').on(table.handle),
    liveIndex('idx_product_category_parent_id_rank').on(table.parentId, table.rank),
  ],
)

export type ProductCategory = typeof productCategoryTable.$inferSelect
export type CreateProductCategory = typeof productCategoryTable.$inferInsert
