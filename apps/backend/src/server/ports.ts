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
