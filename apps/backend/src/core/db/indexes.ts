import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { index, uniqueIndex } from 'drizzle-orm/pg-core'
import { NOT_SOFT_DELETED } from './utils.js'

/**
 * Index authoring helpers for soft-deletable tables.
 *
 * Every table built from the `timestamps` helper carries `deletedAt`, and every read the
 * repository issues filters on it. An index that ignores the predicate is therefore either
 * unusable (the planner cannot match a filtered read against an unfiltered index cheaply) or,
 * for a unique index, actively wrong — a soft-deleted row keeps holding its slot, so the value
 * can never be used again.
 *
 * These helpers apply `deleted_at IS NULL` for you so that omitting it is not something an
 * author has to remember. `scripts/checks` rejects any hand-written index that skips it.
 *
 * Pass `extraPredicate` when the index needs to narrow further; it is ANDed *before* the
 * soft-delete clause:
 *
 *     liveIndex('idx_cart_region_id', sql`region_id IS NOT NULL`).on(table.regionId)
 *     // → WHERE region_id IS NOT NULL AND deleted_at IS NULL
 *
 * Tables with no `deletedAt` column — password reset tokens are the only one — must keep using
 * drizzle's plain `index()`, since there is nothing to filter on.
 */

const notSoftDeleted = sql.raw(NOT_SOFT_DELETED)

function livePredicate(extraPredicate?: SQL): SQL {
  return extraPredicate ? sql`${extraPredicate} AND ${notSoftDeleted}` : notSoftDeleted
}

type IndexColumns = Parameters<ReturnType<typeof index>['on']>

/** A non-unique index covering only rows that are not soft-deleted. */
export function liveIndex(name: string, extraPredicate?: SQL) {
  return {
    on: (...columns: IndexColumns) =>
      index(name)
        .on(...columns)
        .where(livePredicate(extraPredicate)),
  }
}

/** A unique index whose slots are released when the row holding them is soft-deleted. */
export function liveUniqueIndex(name: string, extraPredicate?: SQL) {
  return {
    on: (...columns: IndexColumns) =>
      uniqueIndex(name)
        .on(...columns)
        .where(livePredicate(extraPredicate)),
  }
}
