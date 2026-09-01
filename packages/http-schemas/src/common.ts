import BigNumber from 'bignumber.js'
import { z } from 'zod'
// This module is a public entrypoint (`@proteus/http-schemas/common`), so it cannot rely on a
// namespace index having installed `.openapi()` first. The call is idempotent.
import './openapi-setup.js'

export const dateToIso = z
  .date()
  .transform((d) => d.toISOString())
  .pipe(z.iso.datetime({ offset: true }))

export const timestamps = z.object({
  createdAt: dateToIso,
  updatedAt: dateToIso,
  deletedAt: dateToIso.nullable(),
})

export const bigNumberToString = z
  .custom<BigNumber>((val) => BigNumber.isBigNumber(val))
  .openapi({ type: 'string', description: 'Numeric string (arbitrary precision)' })
  .transform((bn) => bn.toFixed())
  .pipe(z.string())

export const stringToBigNumber = z
  .string()
  .refine((s) => !new BigNumber(s).isNaN(), 'Invalid numeric value')
  .transform((s) => new BigNumber(s))

/** Free-form key/value bag stored as jsonb. Modules still on `text()` keep their own schema. */
export const metadata = z.record(z.string(), z.unknown()).nullable()

export const IdParams = z.object({ id: z.string().min(1) })
export type IdParams = z.infer<typeof IdParams>

export function createOperatorMap() {
  const t = z.string().optional()
  return z.object({
    $eq: t,
    $ne: t,
    $gt: t,
    $gte: t,
    $lt: t,
    $lte: t,
    $like: t,
    $ilike: t,
    $in: z.array(z.string()).optional(),
    $nin: z.array(z.string()).optional(),
  })
}

export function createDateOperatorMap() {
  const t = z.coerce.date().optional()
  return z.object({
    $eq: t,
    $ne: t,
    $gt: t,
    $gte: t,
    $lt: t,
    $lte: t,
    $in: z.array(z.coerce.date()).optional(),
    $nin: z.array(z.coerce.date()).optional(),
  })
}

const defaultPagination = { offset: 0, limit: 20 }

export function createFindParams(defaults?: { limit?: number; offset?: number }) {
  return z.object({
    offset: z.coerce
      .number()
      .int()
      .min(0)
      .default(defaults?.offset ?? defaultPagination.offset),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(defaults?.limit ?? defaultPagination.limit),
    order: z.string().optional(),
  })
}

export const PaginatedResponse = z.object({
  count: z.number(),
  offset: z.number(),
  limit: z.number(),
})

export type FindParams<TParams extends z.ZodType = z.ZodTypeAny> = {
  pagination: {
    offset: number
    limit: number
    order?: Record<string, 'ASC' | 'DESC'>
  }
  filters: Omit<z.infer<TParams>, 'offset' | 'limit' | 'order' | 'q'>
}

export const DeleteResponse = z.object({ id: z.string(), deleted: z.boolean() }).openapi('DeleteResponse')
export type DeleteResponse = z.infer<typeof DeleteResponse>

export const WebhookReceivedResponse = z.object({ received: z.boolean() }).openapi('WebhookReceivedResponse')
export type WebhookReceivedResponse = z.infer<typeof WebhookReceivedResponse>
