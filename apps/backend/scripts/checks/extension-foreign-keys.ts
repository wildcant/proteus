import { getTableConfig } from 'drizzle-orm/pg-core'
import { tableName } from '../../src/core/db/utils.js'
import { locate } from './metadata.js'
import type { Check, Violation } from './types.js'

/**
 * Core's cascade graph is built per module from that module's own tables. A foreign key from an
 * extension table into a core one is an edge that graph never sees: a core soft delete leaves the
 * extension's rows pointing at a hidden row, and a core hard delete is blocked by a constraint core
 * does not know it has. The same holds between two extensions, which never know about each other.
 * So an extension table points at a row outside its own extension by storing the id as plain text.
 */
export const extensionForeignKeys: Check = {
  name: 'extension-foreign-keys',
  rule: 'an extension table holds foreign keys only to tables of its own extension',
  run: (models) => {
    const violations: Violation[] = []
    const owner = new Map(models.map((model) => [model.table, model.extension]))

    for (const { extension, file, table } of models) {
      if (!extension) continue

      for (const key of getTableConfig(table).foreignKeys) {
        const { foreignTable, columns } = key.reference()
        const target = owner.get(foreignTable)
        if (target === extension) continue

        const column = columns[0]?.name ?? '(column)'
        violations.push({
          location: locate(file, column),
          message: `${tableName(table)}.${column} references ${target ? `${target}'s` : 'core'} table ${tableName(foreignTable)}`,
          remedy: 'drop the .references(...) and store the id as plain text — the row it names may be soft-deleted',
        })
      }
    }

    return violations
  },
}
