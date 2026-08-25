import { ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { foreignKey, pgTable, text, unique } from 'drizzle-orm/pg-core'
import { vi } from 'vitest'
import type { Database } from '../../../schema.type.js'
import { buildCascadeGraph } from '../cascade-graph.js'
import { restoreCascade, softDeleteCascade } from '../cascade-walker.js'
import { timestamps } from '../columns.js'
import { liveUniqueIndex } from '../indexes.js'

/**
 * A schema built for the walker rather than borrowed from a module.
 *
 * Most of what the walker promises cannot be reached through the real tables: there are no cycles
 * in them, no diamonds, and only one column-less child. Declaring the shapes here is what lets the
 * guarantees be tested at all, and keeps these tests from breaking when a product model changes.
 */

const rootTable = pgTable(
  'cw_root',
  {
    id: text().primaryKey(),
    /** The second half of the key `cw_pair` cites; defaulted so no other fixture has to know. */
    tag: text().notNull().default('x'),
    ...timestamps,
  },
  (table) => [unique('cw_root_id_tag_key').on(table.id, table.tag)],
)

const childTable = pgTable('cw_child', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const grandchildTable = pgTable('cw_grandchild', {
  id: text().primaryKey(),
  childId: text()
    .notNull()
    .references(() => childTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

/** No `deletedAt`: the table is destroy-only, as password reset tokens are. */
const tokenTable = pgTable('cw_token', {
  id: text().primaryKey(),
  childId: text()
    .notNull()
    .references(() => childTable.id, { onDelete: 'cascade' }),
})

/** Refuses the root's deletion while it is live. */
const guardTable = pgTable('cw_guard', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'restrict' }),
  ...timestamps,
})

/** Refuses a *grandchild's* deletion, so a refusal can be raised two hops below the root. */
const deepGuardTable = pgTable('cw_deep_guard', {
  id: text().primaryKey(),
  grandchildId: text()
    .notNull()
    .references(() => grandchildTable.id, { onDelete: 'restrict' }),
  ...timestamps,
})

/** Reaches its parent by two paths at once, so the walker must handle it once. */
const leafTable = pgTable('cw_leaf', {
  id: text().primaryKey(),
  childId: text()
    .notNull()
    .references(() => childTable.id, { onDelete: 'cascade' }),
  siblingId: text()
    .notNull()
    .references(() => childTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

/** References itself, so a chain of them is a cycle the walker has to stop walking. */
const nodeTable = pgTable('cw_node', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  parentId: text().references((): never => nodeTable.id as never, { onDelete: 'cascade' }),
  ...timestamps,
})

/**
 * The pair that makes refusal order-dependent: both are owned children of the root, and one of
 * them blocks the other. Mirrors `product_option` reaching `product_option_value` and
 * `product_variant_option` in the same event.
 */
const valueTable = pgTable('cw_value', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const holderTable = pgTable('cw_holder', {
  id: text().primaryKey(),
  rootId: text()
    .notNull()
    .references(() => rootTable.id, { onDelete: 'cascade' }),
  valueId: text()
    .notNull()
    .references(() => valueTable.id, { onDelete: 'restrict' }),
  ...timestamps,
})

/**
 * Reaches its parent through a composite foreign key, only one column of which is the parent's
 * primary key. The layered option schema of ticket 06 is shaped this way, and the walker has to
 * travel the id half for real — picking the right column in the graph proves nothing on its own.
 */
const pairTable = pgTable(
  'cw_pair',
  {
    id: text().primaryKey(),
    rootId: text().notNull(),
    rootTag: text().notNull(),
    ...timestamps,
  },
  (table) => [
    foreignKey({ columns: [table.rootId, table.rootTag], foreignColumns: [rootTable.id, rootTable.tag] }).onDelete(
      'cascade',
    ),
  ],
)

/** Holds a unique slot only while it is live, so a restore has something to collide with. */
const slugTable = pgTable(
  'cw_slug',
  {
    id: text().primaryKey(),
    rootId: text()
      .notNull()
      .references(() => rootTable.id, { onDelete: 'cascade' }),
    slug: text().notNull(),
    ...timestamps,
  },
  (table) => [liveUniqueIndex('cw_slug_slug_key').on(table.slug)],
)

const models = {
  rootTable,
  childTable,
  grandchildTable,
  tokenTable,
  guardTable,
  deepGuardTable,
  leafTable,
  nodeTable,
  valueTable,
  holderTable,
  pairTable,
  slugTable,
}

const graph = buildCascadeGraph(models)

const STAMPS =
  'created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz'

const DDL = [
  `create table if not exists cw_root (id text primary key, tag text not null default 'x', unique (id, tag), ${STAMPS})`,
  `create table if not exists cw_child (id text primary key, root_id text not null references cw_root(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cw_grandchild (id text primary key, child_id text not null references cw_child(id) on delete cascade, ${STAMPS})`,
  'create table if not exists cw_token (id text primary key, child_id text not null references cw_child(id) on delete cascade)',
  `create table if not exists cw_guard (id text primary key, root_id text not null references cw_root(id) on delete restrict, ${STAMPS})`,
  `create table if not exists cw_deep_guard (id text primary key, grandchild_id text not null references cw_grandchild(id) on delete restrict, ${STAMPS})`,
  `create table if not exists cw_leaf (id text primary key, child_id text not null references cw_child(id) on delete cascade, sibling_id text not null references cw_child(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cw_node (id text primary key, root_id text not null references cw_root(id) on delete cascade, parent_id text references cw_node(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cw_value (id text primary key, root_id text not null references cw_root(id) on delete cascade, ${STAMPS})`,
  `create table if not exists cw_holder (id text primary key, root_id text not null references cw_root(id) on delete cascade, value_id text not null references cw_value(id) on delete restrict, ${STAMPS})`,
  `create table if not exists cw_slug (id text primary key, root_id text not null references cw_root(id) on delete cascade, slug text not null, ${STAMPS})`,
  `create table if not exists cw_pair (id text primary key, root_id text not null, root_tag text not null, foreign key (root_id, root_tag) references cw_root(id, tag) on delete cascade, ${STAMPS})`,
  'create unique index if not exists cw_slug_slug_key on cw_slug (slug) where deleted_at is null',
]

// Left in place rather than dropped: `globalSetup` rebuilds the worker's database from cold each
// run, and the shared `beforeEach` truncates whatever it finds, so empty tables cost nothing.
test.beforeAll(async () => {
  const { db } = await import('@tests/setup/db-setup.js')
  for (const statement of DDL) await db.execute(sql.raw(statement))
})

const EARLIER = new Date('2025-06-01T00:00:00.000Z')

/**
 * Rows read straight off the table, because a soft delete is only observable as what a later
 * read returns — and these fixture tables have no repository to read them through.
 *
 * `deleted_at` comes back as text, never as a `Date`. The column holds microseconds and a `Date`
 * holds milliseconds, so reading it as one would make two stamps a few microseconds apart compare
 * equal — and the assertions below would lose the ability to tell one event from another.
 */
async function rowsOf(db: Database, table: PgTable): Promise<{ id: string; deletedAt: string | null }[]> {
  return db.select({ id: sql<string>`id::text`, deletedAt: sql<string | null>`deleted_at::text` }).from(table)
}

/** Ids still visible, sorted — what a repository read would return. */
async function liveIds(db: Database, table: PgTable): Promise<string[]> {
  const rows = await rowsOf(db, table)
  return rows
    .filter((row) => row.deletedAt === null)
    .map((row) => row.id)
    .sort()
}

async function stampOf(db: Database, table: PgTable, id: string): Promise<string | null> {
  const rows = await rowsOf(db, table)
  return rows.find((row) => row.id === id)?.deletedAt ?? null
}

test.describe('softDeleteCascade', () => {
  test('travels the whole chain the schema declares', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
    await db.insert(grandchildTable).values({ id: 'grand_1', childId: 'child_1' })

    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    expect(await liveIds(db, rootTable)).toEqual([])
    expect(await liveIds(db, childTable)).toEqual([])
    expect(await liveIds(db, grandchildTable)).toEqual([])
  })

  test('stamps every table it touches with the one timestamp that identifies the event', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
    await db.insert(grandchildTable).values({ id: 'grand_1', childId: 'child_1' })

    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    // Restore matches on this value, so a per-table timestamp would leave microseconds between
    // the tables and nothing would ever match again.
    const event = await stampOf(db, rootTable, 'root_1')
    expect(event).not.toBeNull()
    expect(await stampOf(db, childTable, 'child_1')).toBe(event)
    expect(await stampOf(db, grandchildTable, 'grand_1')).toBe(event)
  })

  test('leaves a child hidden earlier carrying its own timestamp', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1', deletedAt: EARLIER })
    await db.insert(grandchildTable).values({ id: 'grand_1', childId: 'child_1' })
    const before = await stampOf(db, childTable, 'child_1')

    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    // It was never part of this event, so it must not be re-stamped into it — and its own
    // children must not be dragged in either.
    expect(await stampOf(db, childTable, 'child_1')).toBe(before)
    expect(await liveIds(db, grandchildTable)).toEqual(['grand_1'])
  })

  test('does not re-open an event on a root that was already hidden', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1', deletedAt: EARLIER })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
    const before = await stampOf(db, rootTable, 'root_1')

    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    // It keeps the timestamp it was hidden with, and a child that outlived that deletion is
    // not dragged into an event the root was never part of.
    expect(await stampOf(db, rootTable, 'root_1')).toBe(before)
    expect(await liveIds(db, childTable)).toEqual(['child_1'])
  })

  test('leaves another root’s children alone', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values([{ id: 'root_1' }, { id: 'root_2' }])
    await db.insert(childTable).values([
      { id: 'child_1', rootId: 'root_1' },
      { id: 'child_2', rootId: 'root_2' },
    ])

    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    expect(await liveIds(db, childTable)).toEqual(['child_2'])
  })

  test.describe('the timestamp that identifies an event', () => {
    test('separates two deletions the process clock could not tell apart', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values([{ id: 'root_1' }, { id: 'root_2' }])

      // Only `Date` is faked — postgres.js needs real timers to talk to the socket. With the JS
      // clock frozen, `new Date()` returns one value for both deletions, which is exactly what
      // the walker used to stamp them with. The stamp now comes from `clock_timestamp()`, which
      // a frozen JS clock cannot reach.
      vi.useFakeTimers({ toFake: ['Date'] })
      try {
        await softDeleteCascade(db, graph, rootTable, ['root_1'])
        await softDeleteCascade(db, graph, rootTable, ['root_2'])
      } finally {
        vi.useRealTimers()
      }

      const first = await stampOf(db, rootTable, 'root_1')
      expect(first).not.toBeNull()
      expect(await stampOf(db, rootTable, 'root_2')).not.toBe(first)
    })
  })

  test.describe('a child with no soft-delete column', () => {
    test('is destroyed rather than hidden, at any depth', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
      await db.insert(tokenTable).values({ id: 'token_1', childId: 'child_1' })

      // Two hops from the root: the rule has to hold below the first level, because reset
      // tokens hang off provider identity as well as off auth identity.
      await softDeleteCascade(db, graph, rootTable, ['root_1'])

      expect(await db.select().from(tokenTable)).toEqual([])
    })
  })

  test.describe('graphs that would otherwise loop', () => {
    test('handles a child reachable by two paths once', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(childTable).values([
        { id: 'child_1', rootId: 'root_1' },
        { id: 'child_2', rootId: 'root_1' },
      ])
      await db.insert(leafTable).values({ id: 'leaf_1', childId: 'child_1', siblingId: 'child_2' })

      await softDeleteCascade(db, graph, rootTable, ['root_1'])

      expect(await liveIds(db, leafTable)).toEqual([])
      expect(await stampOf(db, leafTable, 'leaf_1')).toBe(await stampOf(db, rootTable, 'root_1'))
    })

    test('terminates on a self-referencing chain', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(nodeTable).values({ id: 'node_1', rootId: 'root_1', parentId: null })
      await db.insert(nodeTable).values({ id: 'node_2', rootId: 'root_1', parentId: 'node_1' })
      await db.insert(nodeTable).values({ id: 'node_3', rootId: 'root_1', parentId: 'node_2' })

      await softDeleteCascade(db, graph, rootTable, ['root_1'])

      expect(await liveIds(db, nodeTable)).toEqual([])
    })
  })

  test.describe('restrict relationships', () => {
    test('refuse the deletion and name what blocked it', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
      await db.insert(guardTable).values({ id: 'guard_1', rootId: 'root_1' })

      const error = await softDeleteCascade(db, graph, rootTable, ['root_1']).catch((e) => e)

      expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
      expect(error.message).toContain('cw_guard.root_id')
    })

    test('stop refusing once the blocking row is itself hidden', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(guardTable).values({ id: 'guard_1', rootId: 'root_1', deletedAt: EARLIER })

      await softDeleteCascade(db, graph, rootTable, ['root_1'])

      expect(await liveIds(db, rootTable)).toEqual([])
    })

    test.describe('leave nothing written', () => {
      test('when the root itself is blocked', async ({ getDb, expect }) => {
        const db = getDb()
        await db.insert(rootTable).values({ id: 'root_1' })
        await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
        await db.insert(guardTable).values({ id: 'guard_1', rootId: 'root_1' })

        await softDeleteCascade(db, graph, rootTable, ['root_1']).catch(() => null)

        // Refused, not half-applied. The root is the row the caller asked about, and a caller
        // told "no" that finds its record hidden anyway has been lied to.
        expect(await liveIds(db, rootTable)).toEqual(['root_1'])
        expect(await liveIds(db, childTable)).toEqual(['child_1'])
      })

      test('when the block is two hops down', async ({ getDb, expect }) => {
        const db = getDb()
        await db.insert(rootTable).values({ id: 'root_1' })
        await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
        await db.insert(grandchildTable).values({ id: 'grand_1', childId: 'child_1' })
        await db.insert(deepGuardTable).values({ id: 'deep_1', grandchildId: 'grand_1' })

        const error = await softDeleteCascade(db, graph, rootTable, ['root_1']).catch((e) => e)

        // The refusal is raised below the root, so everything above it had already been hidden
        // by the interleaved walk this replaced.
        expect(error.type).toBe(ErrorTypes.NOT_ALLOWED)
        expect(await liveIds(db, rootTable)).toEqual(['root_1'])
        expect(await liveIds(db, childTable)).toEqual(['child_1'])
        expect(await liveIds(db, grandchildTable)).toEqual(['grand_1'])
      })
    })

    /**
     * `cw_holder` blocks `cw_value`, and one cascade from `cw_root` owns both — so the walker
     * meets the blocker and the blocked table in the same event.
     *
     * Which it reaches first is the order the barrel happens to export them in, and that decides
     * the answer: hide the holder first and no live row is left to block, so the value is hidden
     * along with it. The schema says the value is un-removable while a holder cites it, and a
     * re-ordered export list is not a change to the schema. Both orders must refuse.
     */
    const Orderings = {
      'blocked table first': { rootTable, valueTable, holderTable },
      'blocker first': { rootTable, holderTable, valueTable },
    }

    for (const [order, barrel] of Object.entries(Orderings)) {
      test(`refuse whichever of the pair the walker reaches first — ${order}`, async ({ getDb, expect }) => {
        const db = getDb()
        await db.insert(rootTable).values({ id: 'root_1' })
        await db.insert(valueTable).values({ id: 'value_1', rootId: 'root_1' })
        await db.insert(holderTable).values({ id: 'holder_1', rootId: 'root_1', valueId: 'value_1' })

        const error = await softDeleteCascade(db, buildCascadeGraph(barrel), rootTable, ['root_1']).catch((e) => e)

        expect(error?.type).toBe(ErrorTypes.NOT_ALLOWED)
        expect(await liveIds(db, valueTable)).toEqual(['value_1'])
      })
    }
  })

  test.describe('a child that references its parent through a composite key', () => {
    test('follows the half of the key that is the parent’s primary key', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values({ id: 'root_1' })
      await db.insert(pairTable).values({ id: 'pair_1', rootId: 'root_1', rootTag: 'x' })

      await softDeleteCascade(db, graph, rootTable, ['root_1'])

      // The graph picking `root_id` is only half the claim; the column it picked has to render
      // into a query that matches, which is what ticket 06 will lean on.
      expect(await liveIds(db, pairTable)).toEqual([])
      expect(await stampOf(db, pairTable, 'pair_1')).toBe(await stampOf(db, rootTable, 'root_1'))
    })
  })

  test.describe('inside a transaction the caller already opened', () => {
    test('rolls back its own writes without taking the caller’s with them', async ({ getDb, expect }) => {
      const db = getDb()
      await db.insert(rootTable).values([{ id: 'root_1' }, { id: 'root_2' }])
      await db.insert(guardTable).values({ id: 'guard_1', rootId: 'root_1' })

      await db.transaction(async (transaction) => {
        // What `BaseRepository.getClient_` hands the walker when a service is mid-transaction.
        const client = transaction as unknown as Database

        await softDeleteCascade(client, graph, rootTable, ['root_1']).catch(() => null)
        await softDeleteCascade(client, graph, rootTable, ['root_2'])
      })

      // drizzle-postgres-js nests through SAVEPOINT, so the refusal discarded only the walker's
      // own attempt. A plain ROLLBACK would have aborted the caller's transaction outright and
      // taken the second deletion down with it.
      expect(await liveIds(db, rootTable)).toEqual(['root_1'])
    })
  })
})

test.describe('restoreCascade', () => {
  test('brings back the children stamped with the matching event', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
    await db.insert(grandchildTable).values({ id: 'grand_1', childId: 'child_1' })
    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    await restoreCascade(db, graph, rootTable, ['root_1'])

    expect(await liveIds(db, rootTable)).toEqual(['root_1'])
    expect(await liveIds(db, childTable)).toEqual(['child_1'])
    expect(await liveIds(db, grandchildTable)).toEqual(['grand_1'])
  })

  test('leaves a child deleted before the event where it was', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values([
      { id: 'child_1', rootId: 'root_1' },
      { id: 'child_2', rootId: 'root_1', deletedAt: EARLIER },
    ])
    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    await restoreCascade(db, graph, rootTable, ['root_1'])

    // Undoing a deletion must not resurrect rows deleted earlier for unrelated reasons.
    expect(await liveIds(db, childTable)).toEqual(['child_1'])
  })

  test('cannot bring back a child that was destroyed', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1' })
    await db.insert(tokenTable).values({ id: 'token_1', childId: 'child_1' })
    await softDeleteCascade(db, graph, rootTable, ['root_1'])

    await restoreCascade(db, graph, rootTable, ['root_1'])

    // The price of the table having no soft-delete column, and the reason a spent credential
    // has no restore path.
    expect(await db.select().from(tokenTable)).toEqual([])
    expect(await liveIds(db, childTable)).toEqual(['child_1'])
  })

  test('does nothing for a root that was never deleted', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values({ id: 'root_1' })
    await db.insert(childTable).values({ id: 'child_1', rootId: 'root_1', deletedAt: EARLIER })

    await restoreCascade(db, graph, rootTable, ['root_1'])

    // A live root contributes no event, so nothing beneath it may be swept back in.
    expect(await liveIds(db, childTable)).toEqual([])
  })

  test('restores each root against its own event', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values([{ id: 'root_1' }, { id: 'root_2' }])
    await db.insert(childTable).values([
      { id: 'child_1', rootId: 'root_1' },
      { id: 'child_2', rootId: 'root_2' },
    ])
    await softDeleteCascade(db, graph, rootTable, ['root_1'])
    await softDeleteCascade(db, graph, rootTable, ['root_2'])

    await restoreCascade(db, graph, rootTable, ['root_1', 'root_2'])

    expect(await liveIds(db, childTable)).toEqual(['child_1', 'child_2'])
  })

  test('reports a unique slot that was refilled while the row was hidden', async ({ getDb, expect }) => {
    const db = getDb()
    await db.insert(rootTable).values([{ id: 'root_1' }, { id: 'root_2' }])
    await db.insert(slugTable).values({ id: 'slug_1', rootId: 'root_1', slug: 'blue-tee' })
    await softDeleteCascade(db, graph, rootTable, ['root_1'])
    // Hiding `slug_1` released its slot, so this is a legitimate write — and it is what makes
    // the restore impossible.
    await db.insert(slugTable).values({ id: 'slug_2', rootId: 'root_2', slug: 'blue-tee' })

    const error = await restoreCascade(db, graph, rootTable, ['root_1']).catch((e) => e)

    // "slug \"blue-tee\" already exists" would read like a bad create and send the reader
    // looking for a duplicate request. The row coming back is the one that is late.
    expect(error.type).toBe(ErrorTypes.DUPLICATE_ERROR)
    expect(error.message).toContain('Cannot restore')
    expect(error.message).toContain('blue-tee')
    // The refusal rolls the whole restore back, so the root it was asked about stays hidden.
    expect(await liveIds(db, rootTable)).toEqual(['root_2'])
  })
})
