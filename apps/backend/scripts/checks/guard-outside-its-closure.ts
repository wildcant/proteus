import type { PgTable } from 'drizzle-orm/pg-core'
import { buildCascadeGraph } from '../../src/core/db/cascade-graph.js'
import { tableName } from '../../src/core/db/utils.js'
import { collectBarrelTables } from './models.js'
import type { Check, Violation } from './types.js'

/**
 * Overlaps that are known and deliberate, keyed by the guard relationship, with the reason.
 *
 * Mirrors `EXEMPT` in `standard-timestamps.ts`: the shape stays visible in one place, stated once,
 * rather than being silently tolerated wherever it happens to occur.
 */
const ALLOWED: Record<string, string> = {}

/**
 * A **guard** is a table whose `on delete restrict` reference refuses another table's deletion; the
 * table it points at is the **guarded table**. A **cascade closure** is every table one deletion
 * reaches by following `on delete cascade` from a root.
 *
 * An **overlap** is a closure holding both a guard and the table it guards. It is legal, and the
 * walker now answers it consistently — checking against pre-cascade state, so the guard blocks
 * whether or not the same event would have hidden it. But it means the deletion of that root is
 * refused whenever a guard row exists, which is rarely what the author of the closure intended:
 * they wrote two `cascade` edges expecting both children to go, and got a permanent refusal.
 *
 * A warning rather than an error, because the fix is a schema redesign rather than a line to
 * change, and shipping one is not something a check should be able to block.
 */
export const guardOutsideItsClosure: Check = {
  name: 'guard-outside-its-closure',
  rule: 'no cascade closure contains both a guard and the table it guards',
  severity: 'warning',
  run: async () => {
    const violations: Violation[] = []

    for (const [module, tables] of await collectBarrelTables()) {
      const barrel = Object.fromEntries([...tables].map((table) => [tableName(table), table]))
      const graph = buildCascadeGraph(barrel)

      for (const root of tables) {
        const closure = closureOf(graph, root)

        for (const guarded of closure) {
          for (const edge of graph.blockersOf(guarded)) {
            if (!closure.has(edge.table)) continue
            if (edge.relationship in ALLOWED) continue

            violations.push({
              location: `${module}: deleting ${tableName(root)}`,
              message: `deleting a ${tableName(root)} reaches both ${tableName(guarded)} and ${edge.relationship}, which refuses it — so that deletion is refused whenever a ${tableName(edge.table)} row exists`,
              remedy: `split the closure so the guard is not owned by the same root, or record it in ALLOWED in scripts/checks/guard-outside-its-closure.ts with the reason the refusal is intended`,
            })
          }
        }
      }
    }

    return violations
  },
}

/** Every table one deletion of `root` reaches, `root` included. */
function closureOf(graph: ReturnType<typeof buildCascadeGraph>, root: PgTable): Set<PgTable> {
  const reached = new Set<PgTable>([root])
  const pending: PgTable[] = [root]

  while (pending.length > 0) {
    const table = pending.pop()
    if (!table) continue

    for (const edge of graph.ownedChildrenOf(table)) {
      if (reached.has(edge.table)) continue
      reached.add(edge.table)
      pending.push(edge.table)
    }
  }

  return reached
}
