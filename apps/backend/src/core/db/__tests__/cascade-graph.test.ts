import { test } from '@tests/setup/test-extend.js'
import { foreignKey, pgTable, text } from 'drizzle-orm/pg-core'
import { buildCascadeGraph, type CascadeEdge } from '../cascade-graph.js'
import { timestamps } from '../columns.js'
import { tableName } from '../utils.js'

/**
 * The graph is read off foreign keys, so these fixtures are foreign keys and nothing else — a
 * handful of tables shaped to say one thing each. They are never created in the database: nothing
 * here executes SQL, and building the graph only reads a table's config.
 */

const parentTable = pgTable('cg_parent', {
  id: text().primaryKey(),
  /** Neither is a primary key, so a reference to them is one the walker cannot follow. */
  code: text().notNull(),
  label: text().notNull(),
  ...timestamps,
})

const childTable = pgTable('cg_child', {
  id: text().primaryKey(),
  parentId: text()
    .notNull()
    .references(() => parentTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const secondChildTable = pgTable('cg_second_child', {
  id: text().primaryKey(),
  parentId: text()
    .notNull()
    .references(() => parentTable.id, { onDelete: 'cascade' }),
  ...timestamps,
})

const blockerTable = pgTable('cg_blocker', {
  id: text().primaryKey(),
  parentId: text()
    .notNull()
    .references(() => parentTable.id, { onDelete: 'restrict' }),
  ...timestamps,
})

const nullingTable = pgTable('cg_nulling', {
  id: text().primaryKey(),
  parentId: text().references(() => parentTable.id, { onDelete: 'set null' }),
  ...timestamps,
})

const undeclaredTable = pgTable('cg_undeclared', {
  id: text().primaryKey(),
  parentId: text().references(() => parentTable.id),
  ...timestamps,
})

const names = (edges: readonly CascadeEdge[]) => edges.map((edge) => tableName(edge.table))

test.describe('buildCascadeGraph', () => {
  test.describe('which relationships become edges', () => {
    test('a cascade reference makes the child an owned child of the parent', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })

      expect(names(graph.ownedChildrenOf(parentTable))).toEqual(['cg_child'])
    })

    test('a restrict reference makes the child a blocker instead', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, blockerTable })

      expect(names(graph.blockersOf(parentTable))).toEqual(['cg_blocker'])
      expect(graph.ownedChildrenOf(parentTable)).toHaveLength(0)
    })

    test('the edge points from parent to child, never the other way', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })

      // The declaration lives on the child; the graph answers questions about the parent.
      expect(graph.ownedChildrenOf(childTable)).toHaveLength(0)
      expect(graph.blockersOf(childTable)).toHaveLength(0)
    })

    test('every other on-delete action is ignored', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, nullingTable, undeclaredTable })

      // `set null` and an undeclared action are the database's business on a hard delete and
      // say nothing about ownership, so a soft delete must not travel down either.
      expect(graph.ownedChildrenOf(parentTable)).toHaveLength(0)
      expect(graph.blockersOf(parentTable)).toHaveLength(0)
    })

    test('a parent collects every child that declares one', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable, secondChildTable, blockerTable })

      expect(names(graph.ownedChildrenOf(parentTable)).sort()).toEqual(['cg_child', 'cg_second_child'])
      expect(names(graph.blockersOf(parentTable))).toEqual(['cg_blocker'])
    })
  })

  test.describe('the edge it hands the walker', () => {
    test('names the relationship as the database spells it', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })
      const [edge] = graph.ownedChildrenOf(parentTable)

      // This string is what a refusal message quotes, so it has to match the schema an
      // on-call engineer would go and read.
      expect(edge?.relationship).toBe('cg_child.parent_id')
    })

    test('carries the column the walker matches parent ids against', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })
      const [edge] = graph.ownedChildrenOf(parentTable)

      expect(edge?.column).toBe(childTable.parentId)
      expect(edge?.table).toBe(childTable)
    })
  })

  test.describe('composite foreign keys', () => {
    test('are followed through the column paired with the parent’s primary key', ({ expect }) => {
      const compositeChildTable = pgTable(
        'cg_composite_child',
        { id: text().primaryKey(), parentId: text().notNull(), parentCode: text().notNull(), ...timestamps },
        (table) => [
          foreignKey({
            columns: [table.parentId, table.parentCode],
            foreignColumns: [parentTable.id, parentTable.code],
          }).onDelete('cascade'),
        ],
      )

      const graph = buildCascadeGraph({ parentTable, compositeChildTable })
      const [edge] = graph.ownedChildrenOf(parentTable)

      // `parent_code` narrows the match further, and leaving it to the database costs nothing a
      // soft delete can observe — the walker collected parents by id, so id is what it travels.
      expect(edge?.column.name).toBe('parentId')
      expect(edge?.relationship).toBe('cg_composite_child.parent_id')
    })

    test('are refused when none of the referenced columns is a primary key', ({ expect }) => {
      const byCodeTable = pgTable(
        'cg_by_code_pair',
        { id: text().primaryKey(), parentCode: text().notNull(), parentLabel: text().notNull(), ...timestamps },
        (table) => [
          foreignKey({
            columns: [table.parentCode, table.parentLabel],
            foreignColumns: [parentTable.code, parentTable.label],
          }).onDelete('cascade'),
        ],
      )

      // The walker collects parents by id and matches children against that set, so an edge
      // along any other column would silently match nothing.
      expect(() => buildCascadeGraph({ parentTable, byCodeTable })).toThrow(/none of which is a primary key/)
    })

    test('are refused when more than one referenced column is a primary key', ({ expect }) => {
      const twoKeyParentTable = pgTable('cg_two_key_parent', {
        first: text().primaryKey(),
        second: text().primaryKey(),
        ...timestamps,
      })
      const twoKeyChildTable = pgTable(
        'cg_two_key_child',
        { id: text().primaryKey(), parentFirst: text().notNull(), parentSecond: text().notNull(), ...timestamps },
        (table) => [
          foreignKey({
            columns: [table.parentFirst, table.parentSecond],
            foreignColumns: [twoKeyParentTable.first, twoKeyParentTable.second],
          }).onDelete('cascade'),
        ],
      )

      // Nothing in the declaration says which half to travel, and picking one would under-cascade
      // in a way no reader of the schema could predict.
      expect(() => buildCascadeGraph({ twoKeyParentTable, twoKeyChildTable })).toThrow(
        /more than one of which is a primary key/,
      )
    })
  })

  test.describe('what it refuses to build', () => {
    test('a single-column reference to anything but the parent’s primary key', ({ expect }) => {
      const byCodeTable = pgTable('cg_by_code', {
        id: text().primaryKey(),
        parentCode: text()
          .notNull()
          .references(() => parentTable.code, { onDelete: 'cascade' }),
        ...timestamps,
      })

      // The walker collects parents by id and matches children against that set, so a
      // reference to any other column would silently match nothing.
      expect(() => buildCascadeGraph({ parentTable, byCodeTable })).toThrow(/none of which is a primary key/)
    })
  })

  test.describe('reading the barrel', () => {
    test('ignores exports that are not tables', ({ expect }) => {
      const graph = buildCascadeGraph({
        parentTable,
        childTable,
        someEnum: { values: ['a'] },
        someFactory: () => null,
        someConstant: 'cg_child',
      })

      expect(names(graph.ownedChildrenOf(parentTable))).toEqual(['cg_child'])
    })

    test('counts a table re-exported under two names once', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable, childAlias: childTable })

      // A barrel that exports both the table and a legacy alias must not double every edge,
      // which would make the walker visit each child twice.
      expect(graph.ownedChildrenOf(parentTable)).toHaveLength(1)
    })
  })

  test.describe('lookups', () => {
    test('match on table name, not on object identity', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })
      // The same table as a second import would produce: same name, different object.
      const reimportedParent = pgTable('cg_parent', { id: text().primaryKey(), ...timestamps })

      // Callers pass whatever table object they happen to hold; identity is not something
      // they should have to guarantee.
      expect(names(graph.ownedChildrenOf(reimportedParent))).toEqual(['cg_child'])
    })

    test('a table with no children answers with an empty list', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })

      expect(graph.ownedChildrenOf(childTable)).toEqual([])
      expect(graph.blockersOf(childTable)).toEqual([])
    })

    test('that empty list cannot be written into', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })
      const empty = graph.ownedChildrenOf(childTable) as CascadeEdge[]

      // One shared empty array is handed out for every miss, so a caller appending to it
      // would be editing every later lookup's answer.
      expect(() => empty.push({ table: childTable, column: childTable.parentId, relationship: 'x' })).toThrow()
      expect(graph.ownedChildrenOf(blockerTable)).toHaveLength(0)
    })

    test('a populated list cannot be written into either', ({ expect }) => {
      const graph = buildCascadeGraph({ parentTable, childTable })
      const edges = graph.ownedChildrenOf(parentTable) as CascadeEdge[]

      // A lookup hands back the index's own array, so the `readonly` the type claims has to be
      // true of a hit as well as a miss — otherwise one caller's push becomes every later
      // deletion's extra edge.
      expect(() => edges.push({ table: childTable, column: childTable.parentId, relationship: 'x' })).toThrow()
      expect(graph.ownedChildrenOf(parentTable)).toHaveLength(1)
    })
  })
})
