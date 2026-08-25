import { getTableConfig } from 'drizzle-orm/pg-core'
import { isSoftDeletable, tableName } from '../../src/core/db/utils.js'
import { locate } from './metadata.js'
import type { Check, Violation } from './types.js'

/**
 * A destroy-only table — one with no `deletedAt` — is hard-deleted by the cascade walker, and the
 * walker stops descending there: whatever hangs off the row belongs to the database from that
 * point on, which is what a hard delete already means.
 *
 * So a soft-deletable child of one is a contradiction the schema cannot hold. The parent's
 * `DELETE` makes Postgres act on the child's own `on delete cascade` and remove it outright, and
 * the `deletedAt` column the author wrote — along with every restore path that reads it — is a
 * promise nothing can keep.
 */
export const destroyOnlyChildren: Check = {
  name: 'destroy-only-children',
  rule: 'no soft-deletable table hangs off a destroy-only one',
  run: (models) => {
    const violations: Violation[] = []

    for (const { file, table } of models) {
      if (!isSoftDeletable(table)) continue
      const config = getTableConfig(table)

      for (const foreignKey of config.foreignKeys) {
        if (foreignKey.onDelete !== 'cascade') continue

        const parent = foreignKey.reference().foreignTable
        if (isSoftDeletable(parent)) continue

        const column = foreignKey.reference().columns[0]?.name ?? config.name
        violations.push({
          location: locate(file, column),
          message: `${config.name} is soft-deletable but cascades from ${tableName(parent)}, which has no deletedAt — deleting a parent hard-deletes these rows and no restore can bring them back`,
          remedy: `give ${tableName(parent)} the standard timestamps, or drop ...timestamps from ${config.name} so the schema says what actually happens to it`,
        })
      }
    }

    return violations
  },
}
