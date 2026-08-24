import { snakeCase } from '@proteus/utils'
import { is } from 'drizzle-orm'
import type { ForeignKey, PgColumn } from 'drizzle-orm/pg-core'
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
 * The walker matches one column against a set of parent ids, so every edge has to name exactly
 * one column on each side. A composite foreign key still can, as long as exactly one of the
 * columns it references is the parent's primary key — the walker follows that pair and lets the
 * database enforce the rest of the tuple. A reference to anything else is rejected at build time
 * rather than silently under-cascaded, because ids are what the walker collects.
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
      const column = referencingPrimaryKey(config.name, reference)

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

  // Every array a lookup can hand back is frozen, hit and miss alike, so the `readonly` on the
  // return type is true rather than a suggestion — a caller that appended to one would be editing
  // the graph every later deletion is read from.
  freeze(owned)
  freeze(blockers)

  return {
    ownedChildrenOf: (table) => owned.get(tableName(table)) ?? NO_EDGES,
    blockersOf: (table) => blockers.get(tableName(table)) ?? NO_EDGES,
  }
}

function freeze(index: Map<string, CascadeEdge[]>): void {
  for (const edges of index.values()) Object.freeze(edges)
}

/**
 * The column of this reference the walker travels along: the one paired with the parent's primary
 * key.
 *
 * A single-column foreign key has only one candidate. A composite one is followed through
 * whichever column sits opposite the primary key, since that is the value the walker collected
 * from the parent — the remaining columns narrow the match further, and leaving them to the
 * database costs nothing a soft delete can observe.
 */
function referencingPrimaryKey(child: string, reference: ReturnType<ForeignKey['reference']>): PgColumn {
  const pairs = reference.columns.map((column, position) => ({ column, parent: reference.foreignColumns[position] }))
  const viaPrimaryKey = pairs.filter((pair) => pair.parent?.primary)

  const [only] = viaPrimaryKey
  if (viaPrimaryKey.length === 1 && only) return only.column

  const named = pairs.map((pair) => pair.column.name).join(', ')
  if (viaPrimaryKey.length === 0) {
    throw new Error(
      `${child} references ${tableName(reference.foreignTable)} through (${named}), none of which is a ` +
        'primary key — the cascade walker collects parents by their id and would match nothing.',
    )
  }

  throw new Error(
    `${child} references ${tableName(reference.foreignTable)} through (${named}), more than one of which is a ` +
      'primary key — the cascade walker follows a single column and cannot tell which one to travel.',
  )
}
