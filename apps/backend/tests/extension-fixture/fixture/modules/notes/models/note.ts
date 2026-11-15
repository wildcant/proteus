import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../../../../src/core/db/columns.js'
import { liveIndex } from '../../../../../../src/core/db/indexes.js'

export const fixtureNoteTable = pgTable(
  'fixture_notes',
  {
    id: text().primaryKey().default(sql`CONCAT('fnote_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    title: text().notNull(),
    /**
     * The core product the note is about, stored as a plain id. An extension table holds no foreign
     * key to a core table, so a product's soft delete leaves its notes untouched.
     */
    coreProductId: text(),
    ...timestamps,
  },
  (table) => [liveIndex('fixture_notes_core_product_id_idx').on(table.coreProductId)],
)
