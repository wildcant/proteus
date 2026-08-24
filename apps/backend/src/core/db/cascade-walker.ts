import type { Column } from 'drizzle-orm'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import type { CascadeEdge, CascadeGraph } from './cascade-graph.js'
import { isSoftDeletable, tableName } from './utils.js'

/**
 * Walks a soft delete, and its undo, down the relationships the schema declares.
 *
 * The whole cascade shares one timestamp. That is what makes it an *event* rather than a run of
 * unrelated deletions: restore matches on the value, so a child hidden earlier for its own reasons
 * keeps its own timestamp and is left where it is. A per-call `new Date()` — what each repository
 * used to do — would put microseconds between the tables and nothing would ever match again.
 *
 * Tables are written directly rather than through repositories, because coverage must not depend
 * on which tables happened to get one.
 */

// biome-ignore lint/suspicious/noExplicitAny: drizzle's dynamic query builder requires untyped access
type Client = any

type Frontier = { table: PgTable; ids: string[] }[]

export async function softDeleteCascade(
  client: Client,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
  deletedAt: Date,
): Promise<void> {
  const handled = new Handled()
  let frontier: Frontier = [{ table: root, ids: rootIds }]

  while (frontier.length > 0) {
    const next: Frontier = []

    for (const { table, ids } of frontier) {
      const fresh = handled.claim(table, ids)
      if (fresh.length === 0) continue

      await assertNothingBlocks(client, graph, table, fresh)

      const hidden = await hideOrDestroy(client, table, fresh, deletedAt)
      if (hidden.length === 0) continue

      for (const edge of graph.ownedChildrenOf(table)) {
        const children = await liveChildIds(client, edge, hidden)
        if (children.length > 0) next.push({ table: edge.table, ids: children })
      }
    }

    frontier = next
  }
}

export async function restoreCascade(
  client: Client,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
): Promise<void> {
  const id = idColumn(root)

  const rows: { id: string; deletedAt: Date | null }[] = await client
    .select({ id, deletedAt: softDeleteColumn(root) })
    .from(root)
    .where(inArray(id, rootIds))

  await client.update(root).set({ deletedAt: null }).where(inArray(id, rootIds))

  // Serial rather than concurrent: these statements share one transaction, which cannot run them
  // in parallel. Restoring several orders at once is the only case, and it is not a hot path.
  for (const event of groupByDeletion(rows)) {
    await restoreEvent(client, graph, root, event.ids, event.deletedAt)
  }
}

/**
 * Undoes one deletion event. Only children stamped with that same timestamp come back: a child
 * deleted beforehand for an unrelated reason was never part of the event and stays hidden.
 *
 * A destroyed child has nothing to restore. That is the price of the table having no soft-delete
 * column, and the reason the column's absence is a decision rather than an oversight.
 */
async function restoreEvent(
  client: Client,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
  deletedAt: Date,
): Promise<void> {
  const handled = new Handled()
  handled.claim(root, rootIds)
  let frontier: Frontier = [{ table: root, ids: rootIds }]

  while (frontier.length > 0) {
    const next: Frontier = []

    for (const { table, ids } of frontier) {
      for (const edge of graph.ownedChildrenOf(table)) {
        if (!isSoftDeletable(edge.table)) continue

        const childId = idColumn(edge.table)
        const rows: { id: string }[] = await client
          .select({ id: childId })
          .from(edge.table)
          .where(and(inArray(edge.column, ids), eq(softDeleteColumn(edge.table), deletedAt)))

        const children = handled.claim(
          edge.table,
          rows.map((row) => row.id),
        )
        if (children.length === 0) continue

        await client.update(edge.table).set({ deletedAt: null }).where(inArray(childId, children))
        next.push({ table: edge.table, ids: children })
      }
    }

    frontier = next
  }
}

/**
 * Hides the rows, or destroys them when the table has no `deletedAt`.
 *
 * A missing soft-delete column is a deliberate statement that the table is destroy-only — password
 * reset tokens are the only one, and a retained token hash *is* the threat model. The cascade
 * declaration still applies, so the row goes; it just goes for good, and whatever hangs off it
 * belongs to the database from that point on, which is what a hard delete already means.
 *
 * Returns the ids actually hidden, so a row that was already deleted neither takes a new timestamp
 * nor drags its children into an event they were not part of.
 */
async function hideOrDestroy(client: Client, table: PgTable, ids: string[], deletedAt: Date): Promise<string[]> {
  const id = idColumn(table)

  if (!isSoftDeletable(table)) {
    await client.delete(table).where(inArray(id, ids))
    return []
  }

  const rows: { id: string }[] = await client
    .update(table)
    .set({ deletedAt })
    .where(and(inArray(id, ids), isNull(softDeleteColumn(table))))
    .returning({ id })

  return rows.map((row) => row.id)
}

/**
 * Refuses the deletion if anything live still references these rows through a restrict
 * relationship — the same answer the database gives a hard delete, so the declaration stays the
 * single statement of intent and an application check cannot drift from it.
 *
 * This runs at every depth, not only at the root, so it cannot be reached around.
 */
async function assertNothingBlocks(client: Client, graph: CascadeGraph, table: PgTable, ids: string[]): Promise<void> {
  for (const edge of graph.blockersOf(table)) {
    const [blocker] = await client
      .select({ id: idColumn(edge.table) })
      .from(edge.table)
      .where(liveReferences(edge, ids))
      .limit(1)

    if (!blocker) continue

    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: `Cannot delete from ${tableName(table)}: still referenced from ${edge.relationship}`,
    })
  }
}

/**
 * The children a deletion travels to: those still live, since one hidden earlier keeps its own
 * timestamp. On a destroy-only table every row is live by definition.
 */
async function liveChildIds(client: Client, edge: CascadeEdge, parentIds: string[]): Promise<string[]> {
  const rows: { id: string }[] = await client
    .select({ id: idColumn(edge.table) })
    .from(edge.table)
    .where(liveReferences(edge, parentIds))

  return rows.map((row) => row.id)
}

function liveReferences(edge: CascadeEdge, parentIds: string[]) {
  const references = inArray(edge.column, parentIds)
  return isSoftDeletable(edge.table) ? and(references, isNull(softDeleteColumn(edge.table))) : references
}

/** Guards diamonds and cycles: a row is handled the first time it is reached and not again. */
class Handled {
  #byTable = new Map<string, Set<string>>()

  /** The ids not yet handled for this table, recorded as handled on the way out. */
  claim(table: PgTable, ids: string[]): string[] {
    const name = tableName(table)
    let seen = this.#byTable.get(name)
    if (!seen) {
      seen = new Set()
      this.#byTable.set(name, seen)
    }

    const fresh = ids.filter((id) => !seen.has(id))
    for (const id of fresh) seen.add(id)
    return fresh
  }
}

function idColumn(table: PgTable): Column {
  const config = getTableConfig(table)
  const id = config.columns.find((column) => column.primary)
  if (!id) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `${config.name} has no single-column primary key, so the cascade cannot address its rows`,
    })
  }
  return id
}

function softDeleteColumn(table: PgTable): Column {
  const config = getTableConfig(table)
  const column = config.columns.find((candidate) => candidate.name === 'deletedAt')
  if (!column) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `${config.name} has no deletedAt column`,
    })
  }
  return column
}

/** Rows that were never deleted have nothing to restore, so they contribute no event. */
function groupByDeletion(rows: { id: string; deletedAt: Date | null }[]): { deletedAt: Date; ids: string[] }[] {
  const events = new Map<number, { deletedAt: Date; ids: string[] }>()

  for (const row of rows) {
    if (!row.deletedAt) continue
    const event = events.get(row.deletedAt.getTime())
    if (event) {
      event.ids.push(row.id)
      continue
    }
    events.set(row.deletedAt.getTime(), { deletedAt: row.deletedAt, ids: [row.id] })
  }

  return [...events.values()]
}
