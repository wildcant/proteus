import { snakeCase } from '@proteus/utils'
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

/**
 * The soft-delete column, in the two spellings the codebase needs: drizzle knows it by its JS
 * property name, the database by the snake_case one. Every place that decides what "soft-deleted"
 * means reads it from here — the walker when it hides a row, the index helpers when they write a
 * predicate, the checks when they verify one — so those three cannot drift into disagreeing.
 */
export const SOFT_DELETE_COLUMN = 'deletedAt'

export const SOFT_DELETE_COLUMN_SQL = snakeCase(SOFT_DELETE_COLUMN)

/** The predicate every index on a soft-deletable table carries, as the database spells it. */
export const NOT_SOFT_DELETED = `${SOFT_DELETE_COLUMN_SQL} IS NULL`

export function tableName(table: PgTable): string {
  return getTableConfig(table).name
}

/** A table is soft-deletable when it carries the `deletedAt` column from the `timestamps` helper. */
export function isSoftDeletable(table: PgTable): boolean {
  return getTableConfig(table).columns.some((column) => column.name === SOFT_DELETE_COLUMN)
}
