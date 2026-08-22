import { sql } from 'drizzle-orm'
import { jsonb, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'

/** How the storefront should draw an option's values. */
export const productOptionRenderAsEnum = pgEnum('product_option_render_as', ['text', 'swatch'])

export const productOptionTable = pgTable(
  'product_option',
  {
    id: text().primaryKey().default(sql`CONCAT('opt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    renderAs: productOptionRenderAsEnum().default('text').notNull(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [uniqueIndex('idx_product_option_title').on(table.title).where(sql`deleted_at IS NULL`)],
)

export type ProductOption = typeof productOptionTable.$inferSelect
export type CreateProductOption = typeof productOptionTable.$inferInsert
export type ProductOptionRenderAs = (typeof productOptionRenderAsEnum.enumValues)[number]
