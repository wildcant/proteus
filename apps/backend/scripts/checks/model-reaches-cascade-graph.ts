import { tableName } from '../../src/core/db/utils.js'
import { locate } from './metadata.js'
import { collectCascadeLists, displayPath } from './models.js'
import type { Check, Violation } from './types.js'

/**
 * A cascade graph is built from a list of tables named in one place, so a table that list does not
 * name is invisible to it. The table keeps its foreign keys and keeps looking correct in review;
 * it simply stops being reached by them, and a soft delete quietly leaves its rows readable.
 * Nothing else in the codebase would notice — `tsc`, `check:structure` and the whole test suite
 * all pass with a table left out — which is why this is a check.
 *
 * Every list is checked, wherever it is written: a module's `Module()` definition, the three
 * `sync-providers.ts` that build their own outside the container, `link-modules/index.ts`, and any
 * test that reproduces one. A list is held to the modules it draws from — name one table of a
 * module and you have to name them all, because a partial graph under-cascades in exactly the way
 * a complete one does not. A list that draws from no module is the cascade graph's own fixtures,
 * which are synthetic tables and have no module to be complete about.
 */
export const modelReachesCascadeGraph: Check = {
  name: 'model-reaches-cascade-graph',
  rule: 'every model is in every list its cascade graph is built from',
  run: async (models) => {
    const violations: Violation[] = []

    for (const list of await collectCascadeLists()) {
      const modules = new Set(models.filter((model) => list.tables.has(model.table)).map((model) => model.module))
      const where = `${displayPath(list.file)}:${list.line}`

      for (const model of models) {
        if (!modules.has(model.module) || list.tables.has(model.table)) continue

        const name = tableName(model.table)
        violations.push({
          location: locate(model.file, name),
          message: `${name} is declared in ${model.file} but the ${model.module} cascade list at ${where} does not name it`,
          remedy: `add it to that list — a cascade graph built without it will not reach it`,
        })
      }
    }

    return violations
  },
}
