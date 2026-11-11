import { sql } from 'drizzle-orm'
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { timestamps } from '../../../core/db/columns.js'
import { liveIndex } from '../../../core/db/indexes.js'
import type {
  ProductImportErrorDTO,
  ProductImportOptionsDTO,
  ProductImportStatus,
  ProductImportSummaryDTO,
} from '../../../core/types/product/common.js'

/**
 * One CSV import, from preview to finish. The preview *is* the plan: the file is parsed once, its
 * products written to `chunks` in file storage, and confirming runs those chunks rather than reading
 * the CSV again. The counters and `errors` grow as the run records each product.
 */
export const productImportTable = pgTable(
  'product_import',
  {
    id: text().primaryKey().default(sql`CONCAT('pimp_', REPLACE(gen_random_uuid()::text, '-', ''))`),
    fileId: text().notNull(),
    options: jsonb().$type<ProductImportOptionsDTO>().notNull(),
    status: text().$type<ProductImportStatus>().notNull(),
    summary: jsonb().$type<ProductImportSummaryDTO>().notNull(),
    chunks: jsonb().$type<string[]>().default([]).notNull(),
    created: integer().default(0).notNull(),
    updated: integer().default(0).notNull(),
    skipped: integer().default(0).notNull(),
    failed: integer().default(0).notNull(),
    errors: jsonb().$type<ProductImportErrorDTO[]>().default([]).notNull(),
    createdBy: text(),
    ...timestamps,
  },
  (table) => [liveIndex('idx_product_import_status_created_at').on(table.status, table.createdAt)],
)
