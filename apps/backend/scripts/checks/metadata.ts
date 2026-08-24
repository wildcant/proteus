import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core'
import { BACKEND_ROOT } from './models.js'

const dialect = new PgDialect()

export function tableName(table: PgTable): string {
  return getTableConfig(table).name
}

/** A table is soft-deletable when it carries the `deletedAt` column from the `timestamps` helper. */
export function isSoftDeletable(table: PgTable): boolean {
  return getTableConfig(table).columns.some((column) => column.name === 'deletedAt')
}

export function renderPredicate(predicate: SQL | undefined): string | null {
  return predicate ? dialect.sqlToQuery(predicate).sql : null
}

/**
 * True when a predicate confines the index to rows that are not soft-deleted. `IS NOT NULL` does
 * not match, which is what makes a future purge-only index visible rather than silently accepted.
 */
export function excludesSoftDeleted(predicate: SQL | undefined): boolean {
  const rendered = renderPredicate(predicate)
  if (!rendered) return false
  return rendered.toLowerCase().replace(/\s+/g, ' ').includes('deleted_at is null')
}

/**
 * The name of an indexed column, or null when the index entry is an expression rather than a
 * column — an expression can never be the leading column a foreign key needs.
 */
export function columnName(indexed: unknown): string | null {
  if (typeof indexed !== 'object' || indexed === null || !('name' in indexed)) return null
  const { name } = indexed
  return typeof name === 'string' ? name : null
}

/** Drizzle reports a column by its JS property name; index names in this codebase are snake_case. */
export function snakeCase(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

/** Best-effort `file:line` for a declaration, located by the name the author gave it. */
export function locate(file: string, declaration: string): string {
  const lines = readFileSync(join(BACKEND_ROOT, file), 'utf8').split('\n')
  const line = lines.findIndex((text) => text.includes(declaration))
  return line === -1 ? file : `${file}:${line + 1}`
}
