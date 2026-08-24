import type { ExtractTablesWithRelations, SQL } from 'drizzle-orm'
import { and, inArray, isNull, sql } from 'drizzle-orm'
import type { PgColumn, PgTable, PgTransaction } from 'drizzle-orm/pg-core'
import { getTableConfig } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'
import type { Database, DatabaseSchema } from '../../schema.type.js'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import { restoreErrorMapper } from '../errors/db-error-mapper.js'
import type { CascadeEdge, CascadeGraph } from './cascade-graph.js'
import { isSoftDeletable, SOFT_DELETE_COLUMN, tableName } from './utils.js'

/**
 * Walks a soft delete, and its undo, down the relationships the schema declares.
 *
 * A delete happens in three phases — plan, check, write — and never interleaves them. Reading the
 * whole closure before checking anything is what makes the answer independent of traversal order:
 * a restrict check run halfway through the hiding sees a table the cascade has already emptied,
 * and whether it sees that depends on which edge a models barrel happened to export first. All
 * three phases share one transaction, so a refusal leaves nothing behind.
 *
 * The whole cascade shares one timestamp. That is what makes it an *event* rather than a run of
 * unrelated deletions: restore matches on the value, so a child hidden earlier for its own reasons
 * keeps its own timestamp and is left where it is.
 *
 * Tables are written directly rather than through repositories, because coverage must not depend
 * on which tables happened to get one.
 */

/** What a repository hands the walker: the pool, or a transaction a caller already opened. */
type Client = Database

/**
 * The transaction the walker opens for itself, and the only client its phases accept.
 *
 * Opening one is safe either way it was called. drizzle-postgres-js issues a nested transaction as
 * `SAVEPOINT` / `ROLLBACK TO`, so a refusal inside a caller's transaction discards the walker's
 * own writes and leaves the caller's intact — which is what lets the callers that reach a
 * repository without one (workflow compensation steps, `dismissLinks`) stay as they are.
 */
type Transaction = PgTransaction<PostgresJsQueryResultHKT, DatabaseSchema, ExtractTablesWithRelations<DatabaseSchema>>

/**
 * One deletion event's identity, as Postgres printed it.
 *
 * It stays text from the moment it is read to the moment it is matched, and is never parsed.
 * `timestamptz` holds microseconds and a JS `Date` holds milliseconds, so a stamp that went
 * through `Date` comes back truncated and stops matching the rows the same cascade just wrote.
 */
type DeletionStamp = string

/** A table and the rows of it one cascade would touch, collected before anything is written. */
type Planned = { table: PgTable; ids: string[] }

type Frontier = { table: PgTable; ids: string[] }[]

export async function softDeleteCascade(
  client: Client,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
): Promise<void> {
  await client.transaction(async (transaction) => {
    const plan = await planCascade(transaction, graph, root, rootIds)
    await assertNothingBlocks(transaction, graph, plan)
    await applyCascade(transaction, plan)
  })
}

/**
 * Phase one — every row the cascade would touch, collected before a single write.
 *
 * One entry per table rather than one per frontier round, so each table is written exactly once
 * with every id it owes. That makes the id lists larger than the old per-frontier batches; a
 * cascade would need roughly 65,000 rows in one table to reach Postgres's bind-parameter cap, and
 * no path comes near it.
 */
async function planCascade(
  client: Transaction,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
): Promise<Planned[]> {
  const plan = new Map<string, Planned>()
  const handled = new Handled()

  // The root is the only frontier whose ids did not come from a live-filtered read. A row hidden
  // earlier must not take a new timestamp, nor drag its children into an event they were not
  // part of, so it is dropped here rather than at the point of writing.
  let frontier: Frontier = [{ table: root, ids: await liveRowIds(client, root, rootIds) }]

  while (frontier.length > 0) {
    const next: Frontier = []

    for (const { table, ids } of frontier) {
      const fresh = handled.claim(table, ids)
      if (fresh.length === 0) continue

      const planned = plan.get(tableName(table))
      if (planned) planned.ids.push(...fresh)
      else plan.set(tableName(table), { table, ids: [...fresh] })

      // A destroy-only table is hard-deleted, and whatever hangs off it belongs to the database
      // from that point on — which is what a hard delete already means.
      if (!isSoftDeletable(table)) continue

      for (const edge of graph.ownedChildrenOf(table)) {
        const children = await liveChildIds(client, edge, fresh)
        if (children.length > 0) next.push({ table: edge.table, ids: children })
      }
    }

    frontier = next
  }

  return [...plan.values()]
}

/**
 * Phase two — refuses the whole cascade if anything live still references any row it would touch
 * through a restrict relationship. The same answer the database gives a hard delete, so the
 * declaration stays the single statement of intent and an application check cannot drift from it.
 *
 * Every check reads the state the caller asked about, because nothing has been written yet. A
 * guard this same cascade would itself hide therefore still blocks: the schema says the guarded
 * row cannot go while a guard cites it, and the order the two happen to be reached in is not
 * something the schema states.
 */
async function assertNothingBlocks(client: Transaction, graph: CascadeGraph, plan: Planned[]): Promise<void> {
  for (const { table, ids } of plan) {
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
}

/**
 * Phase three — the writes, once every check has passed.
 *
 * `WHERE deleted_at IS NULL` survives from the old interleaved walk: the plan was read earlier in
 * this transaction, and under `READ COMMITTED` another transaction can commit a deletion in
 * between. A row hidden that way keeps the timestamp it was hidden with.
 */
async function applyCascade(client: Transaction, plan: Planned[]): Promise<void> {
  // A root that was already hidden plans nothing, and an event with no rows in it needs no
  // identity — so the common re-delete does not pay for a round trip.
  if (plan.length === 0) return

  const deletedAt = await readStamp(client)

  // Serial rather than concurrent: these statements share one transaction, which cannot run them
  // in parallel.
  for (const { table, ids } of plan) {
    const id = idColumn(table)

    if (!isSoftDeletable(table)) {
      await client.delete(table).where(inArray(id, ids))
      continue
    }

    await client
      .update(table)
      .set({ [SOFT_DELETE_COLUMN]: asTimestamp(deletedAt) })
      .where(and(inArray(id, ids), isNull(softDeleteColumn(table))))
  }
}

/**
 * The event's identity, taken from the database rather than from the process clock.
 *
 * `clock_timestamp()` rather than `now()`, because `now()` is the transaction's start time and
 * would hand every cascade in one transaction the same value, merging them into a single event.
 * And rather than `new Date()`, which resolves to the millisecond: two deletions inside one are
 * indistinguishable, so restoring the second would sweep the first back with it.
 */
async function readStamp(client: Transaction): Promise<DeletionStamp> {
  const [row] = await client.execute<{ stamp: string }>(sql`select clock_timestamp()::text as stamp`)
  if (!row) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: 'The database returned no timestamp to identify this deletion',
    })
  }
  return row.stamp
}

export async function restoreCascade(
  client: Client,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
): Promise<void> {
  await client
    .transaction(async (transaction) => {
      const id = idColumn(root)

      const rows = await transaction
        .select({ id, deletedAt: stampColumn(root) })
        .from(root)
        .where(inArray(id, rootIds))

      await transaction
        .update(root)
        .set({ [SOFT_DELETE_COLUMN]: null })
        .where(inArray(id, rootIds))

      // Serial rather than concurrent: these statements share one transaction, which cannot run
      // them in parallel. Restoring several orders at once is the only case, and it is not a hot
      // path.
      for (const event of groupByDeletion(rows)) {
        await restoreEvent(transaction, graph, root, event.ids, event.deletedAt)
      }
    })
    .catch(restoreErrorMapper)
}

/**
 * Undoes one deletion event. Only children stamped with that same timestamp come back: a child
 * deleted beforehand for an unrelated reason was never part of the event and stays hidden.
 *
 * A destroyed child has nothing to restore. That is the price of the table having no soft-delete
 * column, and the reason the column's absence is a decision rather than an oversight.
 */
async function restoreEvent(
  client: Transaction,
  graph: CascadeGraph,
  root: PgTable,
  rootIds: string[],
  deletedAt: DeletionStamp,
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
        const rows = await client
          .select({ id: childId })
          .from(edge.table)
          .where(and(inArray(edge.column, ids), stampedWith(edge.table, deletedAt)))

        const children = handled.claim(edge.table, toIds(rows))
        if (children.length === 0) continue

        await client
          .update(edge.table)
          .set({ [SOFT_DELETE_COLUMN]: null })
          .where(inArray(childId, children))
        next.push({ table: edge.table, ids: children })
      }
    }

    frontier = next
  }
}

/** The rows of `table` among `ids` that are still visible. Every row of a destroy-only one is. */
async function liveRowIds(client: Transaction, table: PgTable, ids: string[]): Promise<string[]> {
  const id = idColumn(table)
  const among = inArray(id, ids)

  const rows = await client
    .select({ id })
    .from(table)
    .where(isSoftDeletable(table) ? and(among, isNull(softDeleteColumn(table))) : among)

  return toIds(rows)
}

/**
 * The children a deletion travels to: those still live, since one hidden earlier keeps its own
 * timestamp. On a destroy-only table every row is live by definition.
 */
async function liveChildIds(client: Transaction, edge: CascadeEdge, parentIds: string[]): Promise<string[]> {
  const rows = await client
    .select({ id: idColumn(edge.table) })
    .from(edge.table)
    .where(liveReferences(edge, parentIds))

  return toIds(rows)
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

/**
 * Columns are resolved from the table config at runtime, so drizzle types their values `unknown`.
 * Every primary key in the schema is a text column, which is what makes this narrowing honest.
 */
function toIds(rows: { id: unknown }[]): string[] {
  return rows.map((row) => String(row.id))
}

function idColumn(table: PgTable): PgColumn {
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

function softDeleteColumn(table: PgTable): PgColumn {
  const config = getTableConfig(table)
  const column = config.columns.find((candidate) => candidate.name === SOFT_DELETE_COLUMN)
  if (!column) {
    throw new AppError({
      type: ErrorTypes.UNEXPECTED_STATE,
      message: `${config.name} has no ${SOFT_DELETE_COLUMN} column`,
    })
  }
  return column
}

/** Reads the stamp as Postgres prints it, so drizzle never hands back a millisecond-wide `Date`. */
function stampColumn(table: PgTable): SQL<string | null> {
  return sql<string | null>`${softDeleteColumn(table)}::text`
}

/** Matches the stamp Postgres stored, without letting it become a `Date` on the way in. */
function stampedWith(table: PgTable, deletedAt: DeletionStamp): SQL {
  return sql`${softDeleteColumn(table)} = ${asTimestamp(deletedAt)}`
}

function asTimestamp(deletedAt: DeletionStamp): SQL {
  return sql`${deletedAt}::timestamptz`
}

/** Rows that were never deleted have nothing to restore, so they contribute no event. */
function groupByDeletion(
  rows: { deletedAt: string | null; id: unknown }[],
): { deletedAt: DeletionStamp; ids: string[] }[] {
  const events = new Map<DeletionStamp, { deletedAt: DeletionStamp; ids: string[] }>()

  for (const row of rows) {
    if (!row.deletedAt) continue
    const event = events.get(row.deletedAt)
    if (event) {
      event.ids.push(String(row.id))
      continue
    }
    events.set(row.deletedAt, { deletedAt: row.deletedAt, ids: [String(row.id)] })
  }

  return [...events.values()]
}
