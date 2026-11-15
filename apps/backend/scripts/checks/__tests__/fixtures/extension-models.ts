import { pgEnum, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { liveIndex } from '../../../../src/core/db/indexes.js'
import { productTable } from '../../../../src/modules/product/models/product.js'

/** Every name prefixed, and a foreign key that stays inside its extension. */
export const acmeShopListTable = pgTable('acme_shop_lists', {
  id: text().primaryKey(),
})

export const acmeShopKindEnum = pgEnum('acme_shop_kind', ['plain', 'pinned'])

export const acmeShopNoteTable = pgTable(
  'acme_shop_notes',
  {
    id: text().primaryKey(),
    listId: text().references(() => acmeShopListTable.id),
    kind: acmeShopKindEnum(),
    coreProductId: text(),
  },
  (table) => [liveIndex('acme_shop_notes_list_id_idx').on(table.listId)],
)

/** One of each unprefixed name, and a foreign key into core. */
export const noteKindEnum = pgEnum('note_kind', ['plain', 'pinned'])

export const strayEnum = pgEnum('stray_kind', ['one'])

export const notesTable = pgTable(
  'notes',
  {
    id: text().primaryKey(),
    slug: text().unique(),
    kind: noteKindEnum(),
    productId: text().references(() => productTable.id),
  },
  (table) => [liveIndex('idx_notes_slug').on(table.slug), unique('notes_kind_slug').on(table.kind, table.slug)],
)
