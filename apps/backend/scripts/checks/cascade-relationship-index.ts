import { getTableConfig } from 'drizzle-orm/pg-core'
import { snakeCase, tableName } from '../../src/core/db/utils.js'
import { columnName, locate } from './metadata.js'
import type { Check, Violation } from './types.js'

const TRAVERSED_ON_DELETE = new Set(['cascade', 'restrict'])

/**
 * Deleting a parent visits its children: the database does it for a hard delete, and the cascade
 * walker does it for a soft one. Either way the child is found by its foreign-key column, so
 * without an index leading on that column every deletion scans the whole child table.
 *
 * A partial index counts — the walker's read carries the soft-delete predicate, so the planner
 * can use one. Only `cascade` and `restrict` are checked: nothing traverses the other actions.
 */
export const cascadeRelationshipIndex: Check = {
  name: 'cascade-relationship-index',
  rule: 'every cascade or restrict relationship is reachable through an index',
  run: (models) => {
    const violations: Violation[] = []

    for (const { file, table } of models) {
      const config = getTableConfig(table)

      const leadingColumns = new Set(
        [
          ...config.indexes.map((index) => index.config.columns[0]),
          ...config.primaryKeys.map((key) => key.columns[0]),
          ...config.columns.filter((column) => column.primary),
        ]
          .map(columnName)
          .filter((name) => name !== null),
      )

      for (const foreignKey of config.foreignKeys) {
        if (!foreignKey.onDelete || !TRAVERSED_ON_DELETE.has(foreignKey.onDelete)) continue

        const reference = foreignKey.reference()
        const leading = reference.columns[0]?.name
        if (!leading || leadingColumns.has(leading)) continue

        violations.push({
          location: locate(file, leading),
          message: `${config.name}.${leading} declares on delete ${foreignKey.onDelete} to ${tableName(reference.foreignTable)} but no index leads with it`,
          remedy: `add liveIndex('idx_${config.name}_${snakeCase(leading)}').on(table.${leading}) — or a plain index() if the table has no deletedAt`,
        })
      }
    }

    return violations
  },
}
