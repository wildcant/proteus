import { snakeCase } from '@proteus/utils'
import { is } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { tableName } from './utils.js'

/**
 * Which children a record owns, read off the schema instead of restated in a service.
 *
 * A foreign key already says what happens to the child when the parent goes — the database acts
 * on that for a hard delete. The same declaration, resolved in the inverse direction, is enough
 * to tell a soft delete what to hide. So there is no per-table list to keep in step: a new child
 * table is covered the moment it declares its relationship, and a service cannot forget one
 * because it never names them in the first place.
 *
 * Scope is a module's own models. No foreign key crosses a module boundary, so a module-scoped
 * graph is complete; a global one would cost the isolation the two-container bootstrap buys.
 */

/** A child table's reference back to its parent, as the walker needs to follow it. */
export type CascadeEdge = {
  /** The table holding the reference — the one a deletion travels *to*. */
  table: PgTable
  /** The referencing column, e.g. `order_line_item.order_id`. */
  column: PgColumn
  /** Printed when a restrict edge refuses a deletion, so the message names the relationship. */
  relationship: string
}

export type CascadeGraph = {
  /** Children that follow the parent into deletion. */
  ownedChildrenOf: (table: PgTable) => readonly CascadeEdge[]
  /** References that forbid the parent's deletion while they are live. */
  blockersOf: (table: PgTable) => readonly CascadeEdge[]
}

const NO_EDGES: readonly CascadeEdge[] = Object.freeze([])

function tablesIn(models: Record<string, unknown>): PgTable[] {
  const tables: PgTable[] = []
  for (const value of Object.values(models)) {
    if (is(value, PgTable) && !tables.includes(value)) tables.push(value)
  }
  return tables
}

/**
 * Builds the inverse foreign-key index for a module's models barrel. Called once per module at
 * bootstrap; the repositories share the result.
 *
 * Two shapes the walker cannot follow are rejected here rather than silently under-cascaded: a
 * composite foreign key, because the walker matches one column against a set of parent ids, and a
 * reference to anything but the parent's primary key, because those ids are what it collects. The
 * schema has neither, and a build-time throw is what keeps it that way.
 */
export function buildCascadeGraph(models: Record<string, unknown>): CascadeGraph {
  // Keyed by table name rather than by the table object, so a lookup succeeds whoever imported
  // the model — identity is not something a caller of `ownedChildrenOf` should have to guarantee.
  const owned = new Map<string, CascadeEdge[]>()
  const blockers = new Map<string, CascadeEdge[]>()

  for (const table of tablesIn(models)) {
    const config = getTableConfig(table)

    for (const foreignKey of config.foreignKeys) {
      const action = foreignKey.onDelete
      if (action !== 'cascade' && action !== 'restrict') continue

      const reference = foreignKey.reference()
      const column = reference.columns[0]
      const parentColumn = reference.foreignColumns[0]
      if (!column || reference.columns.length > 1) {
        throw new Error(
          `${config.name} declares a composite foreign key, which the cascade walker cannot follow. ` +
            'Split it into single-column references, or teach the walker about composites.',
        )
      }
      if (!parentColumn?.primary) {
        throw new Error(
          `${config.name}.${column.name} references a column that is not a primary key, which the ` +
            'cascade walker cannot follow — it collects parents by their id.',
        )
      }

      const edge: CascadeEdge = {
        table,
        column,
        relationship: `${config.name}.${snakeCase(column.name)}`,
      }

      const index = action === 'cascade' ? owned : blockers
      const parent = tableName(reference.foreignTable)
      index.set(parent, [...(index.get(parent) ?? []), edge])
    }
  }

  // A lookup hands back the index's own array, so both sides of the contract are readonly: a
  // caller that appended to one would be editing the graph every later deletion is read from.
  return {
    ownedChildrenOf: (table) => owned.get(tableName(table)) ?? NO_EDGES,
    blockersOf: (table) => blockers.get(tableName(table)) ?? NO_EDGES,
  }
}
