import { getTableConfig } from 'drizzle-orm/pg-core'
import { locate } from './metadata.js'
import type { Check, Violation } from './types.js'

const STANDARD = ['createdAt', 'updatedAt', 'deletedAt'] as const

/**
 * Tables that deliberately do without the standard columns, and why.
 *
 * A table with no `deletedAt` is destroy-only: the cascade walker hard-deletes it rather than
 * hiding it, and nothing can restore it. That is a real decision with real consequences, so it is
 * made once, here, in the open — not by omitting three characters in a model file.
 */
const EXEMPT: Record<string, string> = {
  // biome-ignore lint/style/useNamingConvention: the key is a database table name
  auth_password_reset_token:
    'a single-use bearer credential: a retained token hash is the threat model, and restoring a spent one has no meaning',
}

export const standardTimestamps: Check = {
  name: 'standard-timestamps',
  rule: 'every table carries createdAt, updatedAt and deletedAt unless it is exempt',
  run: (models) => {
    const violations: Violation[] = []

    for (const { file, table } of models) {
      const config = getTableConfig(table)
      if (config.name in EXEMPT) continue

      const declared = new Set(config.columns.map((column) => column.name))
      const missing = STANDARD.filter((column) => !declared.has(column))
      if (missing.length === 0) continue

      violations.push({
        location: locate(file, config.name),
        message: `${config.name} is missing ${missing.join(', ')}`,
        remedy: missing.includes('deletedAt')
          ? `spread ...timestamps from core/db/columns.js, or add ${config.name} to EXEMPT in scripts/checks/standard-timestamps.ts with the reason it can never be restored`
          : 'spread ...timestamps from core/db/columns.js into the table',
      })
    }

    return violations
  },
}
