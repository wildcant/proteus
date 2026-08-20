import {
  and,
  type Column,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  like,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm'

type FilterValue = string | number | boolean | Date | null | FilterValue[] | OperatorMap
type OperatorMap = {
  $eq?: unknown
  $ne?: unknown
  $gt?: unknown
  $gte?: unknown
  $lt?: unknown
  $lte?: unknown
  $like?: string
  $ilike?: string
  $in?: unknown[]
  $nin?: unknown[]
  $is?: null
}
export type FilterRecord = Record<string, FilterValue | undefined> & {
  $and?: FilterRecord[]
  $or?: FilterRecord[]
}

// TODO: refactor into operator strategy map to reduce complexity
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: needs refactor
export function buildFilters(filters: FilterRecord, columns: Record<string, Column>): SQL | undefined {
  const conditions: SQL[] = []

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue

    if (key === '$and' && Array.isArray(value)) {
      const sub = (value as FilterRecord[]).map((f) => buildFilters(f, columns)).filter(Boolean) as SQL[]
      if (sub.length) conditions.push(and(...sub) as SQL)
      continue
    }

    if (key === '$or' && Array.isArray(value)) {
      const sub = (value as FilterRecord[]).map((f) => buildFilters(f, columns)).filter(Boolean) as SQL[]
      if (sub.length) conditions.push(or(...sub) as SQL)
      continue
    }

    const column = columns[key]
    if (!column) continue

    if (value === null) {
      conditions.push(isNull(column))
    } else if (Array.isArray(value)) {
      conditions.push(inArray(column, value))
    } else if (typeof value === 'object' && !(value instanceof Date)) {
      // OperatorMap
      for (const [op, opVal] of Object.entries(value as OperatorMap)) {
        switch (op) {
          case '$eq':
            conditions.push(eq(column, opVal))
            break
          case '$ne':
            conditions.push(ne(column, opVal))
            break
          case '$gt':
            conditions.push(gt(column, opVal))
            break
          case '$gte':
            conditions.push(gte(column, opVal))
            break
          case '$lt':
            conditions.push(lt(column, opVal))
            break
          case '$lte':
            conditions.push(lte(column, opVal))
            break
          case '$like':
            conditions.push(like(column, opVal as string))
            break
          case '$ilike':
            conditions.push(ilike(column, opVal as string))
            break
          case '$in':
            conditions.push(inArray(column, opVal as unknown[]))
            break
          case '$nin':
            conditions.push(notInArray(column, opVal as unknown[]))
            break
          case '$is':
            if (opVal === null) conditions.push(isNull(column))
            break
        }
      }
    } else {
      // Primitive — exact match
      conditions.push(eq(column, value))
    }
  }

  return conditions.length ? and(...conditions) : undefined
}
