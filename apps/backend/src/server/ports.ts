import type { AwilixContainer } from 'awilix'
import type { AuthContext } from '../core/auth/types.js'

// ---- Route handler types (used by api/ route files) ----

type ZodSchema = { _zod: { output: unknown; input: unknown } }
type InferField<T> = T extends ZodSchema ? T['_zod']['output'] : T
type InferResponse<T> = T extends ZodSchema ? T['_zod']['input'] : T

// Mirrors the runtime restructuring in applyMiddleware: raw query fields
// are split into { pagination, filters } before reaching the handler.
type InferQuery<T> = T extends ZodSchema
  ? {
      pagination: {
        offset: number
        limit: number
        order?: Record<string, 'ASC' | 'DESC'>
      }
      filters: Omit<T['_zod']['output'], 'offset' | 'limit' | 'order' | 'q'>
    }
  : T

export type HttpRequest<T = object> = {
  params: T extends { params: infer P } ? InferField<P> : Record<string, string>
  query: Record<string, unknown>
  validatedQuery: T extends { query: infer Q } ? InferQuery<Q> : Record<string, unknown>
  body: T extends { body: infer B } ? InferField<B> : unknown
  /**
   * The request body exactly as it arrived, before any parsing. Only routes verifying a
   * signature over the transmitted bytes need it — everything else reads `body`, and a
   * re-serialisation of `body` is not a substitute: it differs from what was signed.
   *
   * Absent when the platform adapter had no body to read, and when a route handler is called
   * directly rather than over HTTP.
   */
  rawBody?: Uint8Array
  /**
   * Keeps work alive past the response, on a platform that would otherwise cancel it.
   *
   * workerd tears down pending async work the moment a `fetch` handler's response is delivered,
   * so anything scheduled for after the response has to be handed back through the execution
   * context or it silently never runs. Node has no such context and needs none — the process
   * outlives the response — so this is absent there and callers must work without it.
   */
  waitUntil?: (work: Promise<unknown>) => void
  files?: File[]
  scope: AwilixContainer
  headers: Record<string, string>
  authContext?: AuthContext
  pricingContext?: { currencyCode: string }
}

export type HttpResult<T = unknown> = {
  status: number
  json: InferResponse<T>
}

export type RouteHandler = <T>(req: HttpRequest) => Promise<HttpResult<T>>

// ---- Prepared route (output of route processing, input to framework adapters) ----

export type PreparedRoute = {
  method: string
  matcher: string
  handler: RouteHandler
}
