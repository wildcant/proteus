import { test } from '@tests/setup/test-extend.js'
import { sql, TransactionRollbackError } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import fc from 'fast-check'
import type { Database } from '../../../schema.type.js'
import { buildCascadeGraph } from '../cascade-graph.js'
import { restoreCascade, softDeleteCascade } from '../cascade-walker.js'
import { timestamps } from '../columns.js'

/**
 * One property, aimed at the invariant the example tests can only sample: **the answer a soft
 * delete gives does not depend on the order a models barrel happens to export its tables.**
 *
 * The barrel order is not something the schema states, so two barrels describing the same schema
 * have to behave identically — refuse together, or hide the same rows. The example test pins two
 * hand-picked orderings of three tables; this one covers every ordering of five, against a
 * generated population.
 *
 * Each run is a transaction that is rolled back, because `fc.assert` runs inside a single vitest
 * test and the suite's `beforeEach` truncate fires once for the lot.
 */

const rootTable = pgTable('cwp_root', { id: text().primaryKey(), ...timestamps })

const childTable = pgTable('cwp_child', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

/** Owned by the root, and guarded by the holder — the pair that makes order observable. */
const valueTable = pgTable('cwp_value', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const holderTable = pgTable('cwp_holder', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  valueId: text()
    .notNull()
    .references(() => valueTable.id, { onDelete: 'restrict' }),
  ...timestamps,
})

const grandchildTable = pgTable('cwp_grandchild', {
  id: text().primaryKey(),
  childId: text()
    .notNull()
    .references(() => childTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const TABLES: Record<string, PgTable> = {
  rootTable,
  childTable,
  valueTable,
  holderTable,
  grandchildTable,
}

const STAMPS =
  'created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz'

const DDL = [
  `create table if not exists cwp_root (id text primary key, ${STAMPS})`,
  `create table if not exists cwp_child (id text primary key, root_id text not null references cwp_root(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cwp_value (id text primary key, root_id text not null references cwp_root(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cwp_holder (id text primary key, root_id text not null references cwp_root(id) on delete cascade, value_id text not null references cwp_value(id) on delete restrict, ${STAMPS})`,
  `create table if not exists cwp_grandchild (id text primary key, child_id text not null references cwp_child(id) on delete cascade, ${STAMPS})`,
]

test.beforeAll(async () => {
  const { db } = await import('@tests/setup/db-setup.js')
  for (const statement of DDL) await db.execute(sql.raw(statement))
})

const EARLIER = new Date('2025-06-01T00:00:00.000Z')

type Population = { children: number; values: number; holders: number[]; hiddenEarlier: number[] }

const arbitraryPopulation: fc.Arbitrary<Population> = fc
  .record({ children: fc.integer({ min: 0, max: 2 }), values: fc.integer({ min: 0, max: 2 }) })
  .chain(({ children, values }) =>
    fc.record({
      children: fc.constant(children),
      values: fc.constant(values),
      // Each holder cites one value by index; no values means no holders can exist.
      holders:
        values === 0 ? fc.constant<number[]>([]) : fc.array(fc.integer({ min: 0, max: values - 1 }), { maxLength: 3 }),
      // Children already hidden for their own reasons, which the event must neither adopt nor undo.
      hiddenEarlier:
        children === 0
          ? fc.constant<number[]>([])
          : fc.uniqueArray(fc.integer({ min: 0, max: children - 1 }), { maxLength: children }),
    }),
  )

const arbitraryBarrel = fc.shuffledSubarray(Object.keys(TABLES), { minLength: Object.keys(TABLES).length })

const graph = buildCascadeGraph(TABLES)

/** Refusal, or the ids left visible in every table — the whole observable answer. */
type Outcome = { refused: string } | { live: Record<string, string[]> }

async function seed(tx: Database, population: Population): Promise<void> {
  await tx.insert(rootTable).values({ id: 'root' })
  for (let index = 0; index < population.children; index++) {
    const deletedAt = population.hiddenEarlier.includes(index) ? EARLIER : null
    await tx.insert(childTable).values({ id: `child_${index}`, rootId: 'root', deletedAt })
    await tx.insert(grandchildTable).values({ id: `grand_${index}`, childId: `child_${index}`, deletedAt })
  }
  for (let index = 0; index < population.values; index++) {
    await tx.insert(valueTable).values({ id: `value_${index}`, rootId: 'root' })
  }
  for (const [index, target] of population.holders.entries()) {
    await tx.insert(holderTable).values({ id: `holder_${index}`, rootId: 'root', valueId: `value_${target}` })
  }
}

async function outcomeOf(db: Database, population: Population, barrel: string[]): Promise<Outcome> {
  let outcome: Outcome = { live: {} }

  await db
    .transaction(async (tx) => {
      await seed(tx, population)

      const models = Object.fromEntries(barrel.map((key) => [key, TABLES[key]]))
      const graph = buildCascadeGraph(models)

      try {
        await softDeleteCascade(tx, graph, rootTable, ['root'])

        const live: Record<string, string[]> = {}
        for (const [key, table] of Object.entries(TABLES)) {
          const rows = await tx.select().from(table)
          live[key] = rows
            .filter((row) => !(row.deletedAt instanceof Date))
            .map((row) => String(row.id))
            .sort()
        }
        outcome = { live }
      } catch (error) {
        outcome = { refused: error instanceof Error ? error.message : String(error) }
      }

      tx.rollback()
    })
    .catch((error) => {
      // `tx.rollback()` is drizzle's signal, not a failure. Anything else is.
      if (!(error instanceof TransactionRollbackError)) throw error
    })

  return outcome
}

/** Every row's `deletedAt`, keyed by table and id — the state a round trip has to reproduce. */
async function snapshot(tx: Database): Promise<Record<string, Record<string, string | null>>> {
  const state: Record<string, Record<string, string | null>> = {}

  for (const [key, table] of Object.entries(TABLES)) {
    const rows = await tx.select().from(table)
    state[key] = Object.fromEntries(
      rows.map((row) => [String(row.id), row.deletedAt instanceof Date ? row.deletedAt.toISOString() : null]),
    )
  }

  return state
}

/**
 * Every live row whose owner is hidden — the shape a cascade that stopped short leaves behind.
 * Read off the graph rather than off a list of pairs, so a new edge is covered by construction.
 */
async function liveRowsOwnedByHiddenOnes(tx: Database): Promise<string[]> {
  const state = await snapshot(tx)
  const orphans: string[] = []

  for (const [key, table] of Object.entries(TABLES)) {
    for (const edge of graph.ownedChildrenOf(table)) {
      const rows = await tx.select().from(edge.table)
      const hiddenParents = rows.filter((row) => {
        if (row.deletedAt instanceof Date) return false
        return Boolean(state[key]?.[String(row[edge.column.name as keyof typeof row])])
      })

      orphans.push(...hiddenParents.map((row) => `${edge.relationship}=${String(row.id)}`))
    }
  }

  return orphans
}

test.describe('softDeleteCascade — properties', () => {
  test('the answer does not depend on the order the barrel exports its tables', async ({ getDb, expect }) => {
    const db = getDb()

    await fc.assert(
      fc.asyncProperty(arbitraryPopulation, arbitraryBarrel, arbitraryBarrel, async (population, first, second) => {
        expect(await outcomeOf(db, population, second)).toEqual(await outcomeOf(db, population, first))
      }),
      { numRuns: 40 },
    )
  }, 60_000)

  test('a delete the walker accepted is undone exactly by a restore', async ({ getDb, expect }) => {
    const db = getDb()

    await fc.assert(
      fc.asyncProperty(arbitraryPopulation, async (population) => {
        await db
          .transaction(async (tx) => {
            await seed(tx, population)
            const before = await snapshot(tx)

            try {
              await softDeleteCascade(tx, graph, rootTable, ['root'])
            } catch {
              // A refused delete has nothing to undo; the ordering property covers refusals.
              tx.rollback()
              return
            }

            await restoreCascade(tx, graph, rootTable, ['root'])

            // A child hidden before the event keeps its own timestamp, so `before` is the only
            // state a correct restore can land on — not "everything live".
            expect(await snapshot(tx)).toEqual(before)
            tx.rollback()
          })
          .catch((error) => {
            if (!(error instanceof TransactionRollbackError)) throw error
          })
      }),
      { numRuns: 40 },
    )
  }, 60_000)

  test('an accepted delete leaves no live row owned by a hidden one', async ({ getDb, expect }) => {
    const db = getDb()

    await fc.assert(
      fc.asyncProperty(arbitraryPopulation, async (population) => {
        await db
          .transaction(async (tx) => {
            await seed(tx, population)

            try {
              await softDeleteCascade(tx, graph, rootTable, ['root'])
            } catch {
              tx.rollback()
              return
            }

            expect(await liveRowsOwnedByHiddenOnes(tx)).toEqual([])
            tx.rollback()
          })
          .catch((error) => {
            if (!(error instanceof TransactionRollbackError)) throw error
          })
      }),
      { numRuns: 40 },
    )
  }, 60_000)
})
