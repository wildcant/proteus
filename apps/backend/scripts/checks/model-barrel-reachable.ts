import { tableName } from '../../src/core/db/utils.js'
import { locate } from './metadata.js'
import { barrelOf, collectBarrelTables } from './models.js'
import type { Check, Violation } from './types.js'

/**
 * The cascade graph is built from a module's models barrel and nothing else, so a table the barrel
 * does not re-export is invisible to it. The table keeps its foreign keys and keeps looking correct
 * in review; it simply stops being reached by them, and a soft delete quietly leaves its rows
 * readable. Nothing else in the codebase would notice, which is why this is a check.
 */
export const modelBarrelReachable: Check = {
  name: 'model-barrel-reachable',
  rule: "every model is re-exported from its module's barrel",
  run: async (models) => {
    const barrels = await collectBarrelTables()
    const violations: Violation[] = []

    for (const { module, file, table } of models) {
      if (barrels.get(module)?.has(table)) continue

      const name = tableName(table)
      violations.push({
        location: locate(file, name),
        message: `${name} is declared in ${file} but ${barrelOf(module)} does not re-export it`,
        remedy: `add its export to ${barrelOf(module)} — the cascade graph is built from that barrel`,
      })
    }

    return violations
  },
}
