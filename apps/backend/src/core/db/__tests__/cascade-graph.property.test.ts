import { test } from '@tests/setup/test-extend.js'
import type { PgTable } from 'drizzle-orm/pg-core'
import { pgTable, text } from 'drizzle-orm/pg-core'
import fc from 'fast-check'
import { buildCascadeGraph } from '../cascade-graph.js'
import { timestamps } from '../columns.js'
import { tableName } from '../utils.js'

/**
 * The example tests next door pin one behaviour each against a hand-written schema. These pin the
 * behaviours that have to hold for *every* schema, against a few hundred generated ones — shapes
 * nobody thought to write down, including cycles, self-references, and one parent cited four times.
 *
 * Generating the schema rather than the data is what makes this cheap: `buildCascadeGraph` reads a
 * table's config and touches no database, so a run costs microseconds.
 *
 * What is generated is the *description* — a handful of integers — never the drizzle tables. A
 * counterexample has to be readable, and a `PgTable` serialises to several thousand lines.
 */

const ACTIONS = ['cascade', 'restrict', 'set null', 'no action'] as const

type Declaration = { child: number; parent: number; action: (typeof ACTIONS)[number] }
type Schema = { tableCount: number; declarations: Declaration[] }

const arbitrarySchema = fc.integer({ min: 1, max: 5 }).chain((tableCount) =>
  fc.record({
    tableCount: fc.constant(tableCount),
    declarations: fc.array(
      fc.record({
        child: fc.integer({ min: 0, max: tableCount - 1 }),
        parent: fc.integer({ min: 0, max: tableCount - 1 }),
        action: fc.constantFrom(...ACTIONS),
      }),
      { maxLength: 8 },
    ),
  }),
)

/** One letter per declaration, so the column name survives snake-casing unchanged. */
const columnSuffix = (position: number) => String.fromCharCode(97 + position)

const relationshipOf = (declaration: Declaration, position: number) =>
  `pg_t${declaration.child}.ref${columnSuffix(position)}_id`

function buildTables({ tableCount, declarations }: Schema): PgTable[] {
  // Drizzle resolves `references()` lazily, so the array is fully populated by the time any thunk
  // runs. That is what lets a table reference one declared after it — or itself.
  const tables: PgTable[] = []

  for (let index = 0; index < tableCount; index++) {
    const columns: Record<string, ReturnType<typeof text>> = { id: text().primaryKey() }

    declarations.forEach((declaration, position) => {
      if (declaration.child !== index) return
      columns[`ref${columnSuffix(position)}Id`] = text().references(
        (): never => {
          const parent = tables[declaration.parent]
          if (!parent) throw new Error('the generator described a reference to a table it never built')
          return (parent as unknown as { id: never }).id
        },
        { onDelete: declaration.action },
      )
    })

    tables.push(pgTable(`pg_t${index}`, { ...columns, ...timestamps }))
  }

  return tables
}

const barrelOf = (tables: PgTable[]) => Object.fromEntries(tables.map((table, index) => [`t${index}`, table]))

const relationships = (edges: readonly { relationship: string }[]) => edges.map((edge) => edge.relationship).sort()

const declaredAs = (schema: Schema, parent: number, action: Declaration['action']) =>
  schema.declarations
    .map((declaration, position) => ({ declaration, position }))
    .filter(({ declaration }) => declaration.parent === parent && declaration.action === action)
    .map(({ declaration, position }) => relationshipOf(declaration, position))
    .sort()

test.describe('buildCascadeGraph — properties', () => {
  test('every cascade declaration becomes exactly one owned-child edge, and nothing else does', ({ expect }) => {
    fc.assert(
      fc.property(arbitrarySchema, (schema) => {
        const tables = buildTables(schema)
        const graph = buildCascadeGraph(barrelOf(tables))

        for (const [index, table] of tables.entries()) {
          expect(relationships(graph.ownedChildrenOf(table))).toEqual(declaredAs(schema, index, 'cascade'))
        }
      }),
    )
  })

  test('a restrict declaration becomes a blocker and never an owned child', ({ expect }) => {
    fc.assert(
      fc.property(arbitrarySchema, (schema) => {
        const tables = buildTables(schema)
        const graph = buildCascadeGraph(barrelOf(tables))

        for (const [index, table] of tables.entries()) {
          expect(relationships(graph.blockersOf(table))).toEqual(declaredAs(schema, index, 'restrict'))
        }
      }),
    )
  })

  test('the graph does not depend on the order the barrel exports its tables', ({ expect }) => {
    fc.assert(
      fc.property(arbitrarySchema, fc.integer({ min: 0, max: 1_000 }), (schema, rotation) => {
        const tables = buildTables(schema)
        const rotated = tables.map((_, index) => {
          const table = tables[(index + rotation) % tables.length]
          if (!table) throw new Error('the rotation fell off the end of the barrel')
          return table
        })

        const straight = buildCascadeGraph(barrelOf(tables))
        const shuffled = buildCascadeGraph(barrelOf(rotated))

        for (const table of tables) {
          expect(relationships(shuffled.ownedChildrenOf(table))).toEqual(relationships(straight.ownedChildrenOf(table)))
          expect(relationships(shuffled.blockersOf(table))).toEqual(relationships(straight.blockersOf(table)))
        }
      }),
    )
  })

  test('an edge always names a real column on the table it points at', ({ expect }) => {
    fc.assert(
      fc.property(arbitrarySchema, (schema) => {
        const tables = buildTables(schema)
        const graph = buildCascadeGraph(barrelOf(tables))

        for (const table of tables) {
          for (const edge of [...graph.ownedChildrenOf(table), ...graph.blockersOf(table)]) {
            expect(edge.relationship.startsWith(`${tableName(edge.table)}.`)).toBe(true)
            expect(tableName(edge.column.table)).toBe(tableName(edge.table))
          }
        }
      }),
    )
  })
})
