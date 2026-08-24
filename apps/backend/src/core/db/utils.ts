import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableConfig } from 'drizzle-orm/pg-core'

/**
 * Schema facts read off a drizzle table at runtime.
 *
 * These live in core rather than beside their first caller because two very different places ask
 * the same questions of the same tables: the cascade graph, which decides what a soft delete
 * travels to, and `scripts/checks`, which decides whether the schema is allowed to compile. Those
 * two answering differently is the failure mode worth designing out — a check that disagrees with
 * the walker about what "soft-deletable" means passes a schema the walker then mishandles.
 */

export function tableName(table: PgTable): string {
  return getTableConfig(table).name
}

/** A table is soft-deletable when it carries the `deletedAt` column from the `timestamps` helper. */
export function isSoftDeletable(table: PgTable): boolean {
  return getTableConfig(table).columns.some((column) => column.name === 'deletedAt')
}

/** Drizzle reports a column by its JS property name; the database knows it in snake_case. */
export function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}
