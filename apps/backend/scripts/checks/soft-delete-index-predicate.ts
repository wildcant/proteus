import { snakeCase } from '@proteus/utils'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { isSoftDeletable, SOFT_DELETE_COLUMN_SQL, tableName } from '../../src/core/db/utils.js'
import { excludesSoftDeleted, locate, sourceOf } from './metadata.js'
import type { Check, Violation } from './types.js'

/**
 * On a soft-deletable table an index that ignores `deleted_at` is wrong in one of two ways.
 *
 * A unique index keeps enforcing its slot against rows nobody can read any more, so deleting a
 * user permanently burns their email address. A non-unique index is merely useless: every read
 * the repository issues carries the predicate, and the planner cannot cheaply serve a filtered
 * read from an unfiltered index.
 *
 * Uniqueness declared inline (`text().unique()`) or as a table constraint (`unique().on(...)`)
 * compiles to a constraint, which cannot carry a predicate at all — so it is rejected outright
 * and must be re-declared as a partial unique index.
 *
 * A hand-written predicate is rejected even when it is correct. Checking that the clause is present
 * only catches the author who forgot it; refusing the spelling altogether means the `liveIndex`
 * helpers are the sole way to author an index, so there is no longer a version to forget.
 */
/** Any `sql` fragment in a model naming the soft-delete column — the helpers never produce one. */
const handWrittenPredicate = new RegExp(`sql\`[^\`]*${SOFT_DELETE_COLUMN_SQL}[^\`]*\``, 'i')

export const softDeleteIndexPredicate: Check = {
  name: 'soft-delete-index-predicate',
  rule: 'every index on a soft-deletable table excludes soft-deleted rows, and gets that predicate from liveIndex',
  run: (models) => {
    const violations: Violation[] = []

    for (const { file, table } of models) {
      if (!isSoftDeletable(table)) continue
      const config = getTableConfig(table)

      for (const column of config.columns) {
        if (!column.isUnique) continue
        violations.push({
          location: locate(file, `${column.name}:`),
          message: `${config.name}.${column.name} is declared unique inline`,
          remedy: `replace .unique() with liveUniqueIndex('idx_${config.name}_${snakeCase(column.name)}').on(table.${column.name}) in the table's extras`,
        })
      }

      for (const constraint of config.uniqueConstraints) {
        violations.push({
          location: locate(file, constraint.name ?? 'unique('),
          message: `${config.name} declares the unique constraint "${constraint.name}"`,
          remedy: 'a constraint cannot carry a predicate — declare it with liveUniqueIndex instead',
        })
      }

      for (const index of config.indexes) {
        const { name, unique, where } = index.config
        if (excludesSoftDeleted(where)) continue
        const helper = unique ? 'liveUniqueIndex' : 'liveIndex'
        violations.push({
          location: locate(file, name ?? config.name),
          message: `${tableName(table)} index "${name ?? '(unnamed)'}" does not exclude soft-deleted rows`,
          remedy: `declare it with ${helper} from core/db/indexes.js`,
        })
      }
    }

    for (const file of new Set(models.map((model) => model.file))) {
      if (!handWrittenPredicate.test(sourceOf(file))) continue
      violations.push({
        location: locate(file, SOFT_DELETE_COLUMN_SQL),
        message: `${file} spells the soft-delete predicate out by hand`,
        remedy:
          'drop the .where(...) and declare the index with liveIndex or liveUniqueIndex, which applies it for you',
      })
    }

    return violations
  },
}
