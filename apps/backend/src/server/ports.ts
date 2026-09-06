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

/** Everything on a request that does not depend on which middlewares ran. */
type RequestFields<T> = {
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
  files?: File[]
  scope: AwilixContainer
  headers: Record<string, string>
  authContext?: AuthContext
}

/**
 * A middleware, and what it puts on the request.
 *
 * `Adds` is enforced in both directions. The return type makes the middleware prove it produces
 * the field, so `attachCustomer` cannot forget to set one. The phantom `adds` — which never exists
 * at runtime — lets a route recover that type from a middleware list, so a handler reads
 * `req.customer` only where the middleware that sets it is declared.
 */
export type MiddlewareFunction<Adds = object> = ((
  req: RequestFields<object>,
) => (RequestFields<object> & Adds) | Promise<RequestFields<object> & Adds>) & {
  readonly adds?: Adds
}

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (x: infer I) => void ? I : never

/**
 * Everything a middleware list contributes, intersected — two middlewares each add their own
 * field, so the handler sees both. An empty list contributes nothing.
 */
export type ContextOf<M extends readonly MiddlewareFunction<object>[]> = UnionToIntersection<
  { [K in keyof M]: M[K] extends MiddlewareFunction<infer A> ? A : object }[number]
>

/**
 * The request a handler receives: its validated input, plus whatever its middlewares added.
 *
 * The second parameter is the route's own `*Middlewares` const — `HttpRequest<typeof PostInput,
 * typeof PostMiddlewares>` — so the request type is derived from the list rather than asserted
 * next to it, and the two cannot drift. The definition then forwards that same const as its
 * `middlewares`, alongside the `input` and `output` it already forwards.
 */
export type HttpRequest<T = object, M extends readonly MiddlewareFunction<object>[] = []> = RequestFields<T> &
  ContextOf<M>

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
