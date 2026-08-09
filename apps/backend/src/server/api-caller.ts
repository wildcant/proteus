/**
 * Adapter that lets `createServerFn` call route handlers directly.
 *
 * Builds a fake HttpRequest (scoped container, params, query, body) and
 * feeds it to the handler, returning only the JSON payload. The handlers
 * imported from `api/index.ts` already have middleware applied, so
 * validation and query parsing happen automatically.
 *
 * The data parameter is fully typed: `params` and `body` are required
 * (with their exact types) only when the handler declares them. `query`
 * is required when the handler uses query validation — its value type
 * comes from TanStack's validator, not from here, because middleware
 * transforms the flat query into a structured { pagination, filters } shape.
 *
 * On Workers, each call is wrapped in `dbProvider.withConnection()` so
 * the DB connection is created and disposed per-request.
 */

import { container, dbProvider } from '../framework/runtime/container.workerd.js'

// ---- Type-level helpers ----

/** Extract the request parameter type from a handler function. */
type ReqOf<H> = H extends (req: infer R, ...args: never[]) => unknown ? R : never

/** Extract the `json` return type from a handler. */
type OutputOf<H> = H extends (...args: never[]) => Promise<{ json: infer J }> ? J : never

/** Collapse `{ a: X } & { b: Y }` into a single flat object type. */
type Simplify<T> = { [K in keyof T]: T[K] }

/**
 * Reverse the FindParams transformation so `apiCall` accepts the flat
 * query shape that matches the raw Zod schema (what TanStack validates).
 * Non-FindParams query types pass through unchanged.
 */
type FlattenQuery<Q> = Q extends {
  pagination: { offset: number; limit: number }
  filters: infer F
}
  ? Simplify<{ offset: number; limit: number; order?: string | undefined } & F>
  : Q

/**
 * Build the required data shape from a handler's request type.
 *
 * Detection logic (default = optional, specific = required):
 *   params — default is `Record<string, string>` (has index sig) → `string extends keyof P`
 *   body   — default is `unknown` → `unknown extends B`
 *   query  — default `validatedQuery` is `Record<string, unknown>` (has index sig)
 */
type ApiCallData<H, R = ReqOf<H>> = (R extends { params: infer P }
  ? string extends keyof P
    ? unknown
    : { params: P }
  : unknown) &
  (R extends { body: infer B } ? (unknown extends B ? unknown : { body: B }) : unknown) &
  (R extends { validatedQuery: infer Q } ? (string extends keyof Q ? unknown : { query: FlattenQuery<Q> }) : unknown)

// ---- Runtime ----

export async function apiCall<H extends (...args: never[]) => Promise<{ status: number; json: unknown }>>(
  handler: H,
  ...[data]: keyof ApiCallData<H> extends never ? [] : [data: ApiCallData<H>]
): Promise<OutputOf<H>> {
  return dbProvider.withConnection(async () => {
    const d = data as { params?: unknown; query?: unknown; body?: unknown } | undefined
    const result = await handler({
      scope: container.createScope(),
      params: d?.params ?? {},
      query: d?.query ?? {},
      body: d?.body,
    } as never)
    return result.json as OutputOf<H>
  })
}
