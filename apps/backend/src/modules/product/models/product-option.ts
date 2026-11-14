import { sql } from 'drizzle-orm'
import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveUniqueIndex } from '../../../core/db/indexes.js'

/** How the storefront should draw an option's values. */
export const productOptionRenderAsEnum = pgEnum('product_option_render_as', ['text', 'swatch'])

/**
 * The part an option plays on a store's list card (ADR 0037): `grouping` is the option whose values
 * each have their own look and photo — colour for shoes, material for furniture — and `availability`
 * the option whose in-stock values the card lists, as sizes.
 */
export const productOptionListingRoleEnum = pgEnum('product_option_listing_role', ['grouping', 'availability'])

export const productOptionTable = pgTable(
  'product_option',
  {
    id: text().primaryKey().default(sql`CONCAT('opt_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    renderAs: productOptionRenderAsEnum().default('text').notNull(),
    /** `null` plays no part on the list card. */
    listingRole: productOptionListingRoleEnum(),
    metadata: jsonb().$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('idx_product_option_title').on(table.title)],
)

export type ProductOption = typeof productOptionTable.$inferSelect
export type CreateProductOption = typeof productOptionTable.$inferInsert
export type ProductOptionRenderAs = (typeof productOptionRenderAsEnum.enumValues)[number]
export type ProductOptionListingRole = (typeof productOptionListingRoleEnum.enumValues)[number]
