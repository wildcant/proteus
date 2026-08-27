import type { z } from 'zod'
import { AppError, ErrorTypes } from '../errors/app-error.js'
import { formatZodIssues } from '../errors/format-zod-issues.js'

export function validateQuery<T>(schema: z.ZodType<T>, query: Record<string, unknown>): T {
  const result = schema.safeParse(query)

  if (!result.success) {
    throw new AppError({
      type: ErrorTypes.INVALID_DATA,
      message: `Invalid query params: ${formatZodIssues(result.error.issues)}`,
    })
  }

  return result.data
}

/**
 * `-createdAt,id` -> `{ createdAt: 'DESC', id: 'ASC' }`. Direction is per segment, so a list can
 * mix them. Multiple columns exist for the tiebreaker an offset pager needs: order on a column
 * whose values collide and the database is free to repeat a row on page 2 that page 1 already
 * showed.
 *
 * Key order is preserved, and `find()` maps the entries in that order, so the clauses come out as
 * written.
 */
export function parseOrder(order?: string): Record<string, 'ASC' | 'DESC'> | undefined {
  if (!order) return undefined

  const parsed: Record<string, 'ASC' | 'DESC'> = {}
  for (const segment of order.split(',')) {
    const trimmed = segment.trim()
    // A trailing comma would otherwise become a column named ''.
    if (!trimmed || trimmed === '-') continue
    if (trimmed.startsWith('-')) {
      parsed[trimmed.slice(1)] = 'DESC'
      continue
    }
    parsed[trimmed] = 'ASC'
  }

  return Object.keys(parsed).length ? parsed : undefined
}
