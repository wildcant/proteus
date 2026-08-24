import type { PgTable } from 'drizzle-orm/pg-core'

/** A drizzle table found in a module's `models/` directory, with the file that declares it. */
export type Model = {
  /** Module the model belongs to — `product`, `link-modules`, and so on. */
  module: string
  /** Path relative to `apps/backend`, so violations print as clickable `file:line`. */
  file: string
  table: PgTable
}

export type Violation = {
  /** `file:line` if the line could be located, otherwise just the file. */
  location: string
  message: string
  /** What the author should do about it. */
  remedy: string
}

export type Check = {
  /** Kebab-case identifier, printed as the heading when the check fails. */
  name: string
  /** One line stating the rule, printed when the check passes. */
  rule: string
  run: (models: Model[]) => Violation[]
}
