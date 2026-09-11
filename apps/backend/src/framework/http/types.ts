import type { ErrorTypes } from '@core/errors/app-error.js'
import type { HttpRequest, HttpResult, MiddlewareFunction } from '@server/ports.js'
import type { z } from 'zod'

export type { MiddlewareFunction } from '@server/ports.js'

export type AuthPolicy = 'required' | 'optional' | 'unregistered' | 'public'

export function searchable<T>(...columns: Array<keyof T & string>): string[] {
  return columns
}

export const Tags = {
  AUTH: 'Auth',
  CARTS: 'Carts',
  COUNTRIES: 'Countries',
  CUSTOMERS: 'Customers',
  FULFILLMENTS: 'Fulfillments',
  FULFILLMENT_PROVIDERS: 'Fulfillment Providers',
  FULFILLMENT_SETS: 'Fulfillment Sets',
  PAYMENTS: 'Payments',
  PAYMENT_COLLECTIONS: 'Payment Collections',
  PAYMENT_PROVIDERS: 'Payment Providers',
  PRODUCTS: 'Products',
  PRODUCT_OPTIONS: 'Product Options',
  PRODUCT_VARIANTS: 'Product Variants',
  REFUND_REASONS: 'Refund Reasons',
  REGIONS: 'Regions',
  SHIPPING_OPTIONS: 'Shipping Options',
  SHIPPING_PROFILES: 'Shipping Profiles',
  STORE: 'Store',
  INVITES: 'Invites',
  NOTIFICATIONS: 'Notifications',
  ORDERS: 'Orders',
  UPLOADS: 'Uploads',
  USERS: 'Users',
  WEBHOOKS: 'Webhooks',
} as const

export type Tag = (typeof Tags)[keyof typeof Tags]

export type RouteInput = {
  params?: z.ZodType
  body?: z.ZodType
  query?: z.ZodType
  /**
   * Query parameters a middleware reads straight off `req.query`, before `applyMiddleware`
   * validates anything. Documented in OpenAPI like any other query parameter, on every method
   * rather than only GET, so a POST can carry one too.
   *
   * Separate from `input.query` because that describes which rows the caller wants: everything
   * declared there lands in `validatedQuery.filters` and is offered to a repository as a column
   * filter, which silently ignores the names it does not recognise. These say where the request
   * is coming from instead, and only the middleware that declared them reads them.
   */
  contextQuery?: z.ZodObject
}

type BaseRoute = {
  auth?: AuthPolicy
  description?: string
  // The failure half of the contract, next to `output`, which is the success half. Every type
  // listed becomes a declared response via the same `typeToStatus` map the runtime answers with,
  // so the spec cannot promise a status the API does not send or omit one it does.
  //
  // Structural failures are not listed here — a 400 from schema validation and the 401 an auth
  // middleware sends are derived from the definition itself. What this adds is everything the
  // *handler* decides: a credential check on a public route, a CONFLICT on a duplicate. Errors
  // raised inside a workflow arrive by spreading its own contract, never by restating it:
  //
  //     export const PostThrows = [...createOrderShipmentWorkflow.throws, ErrorTypes.CONFLICT] as const
  //
  // The `route-*-error` rules in `standards/` keep this in step with the handler in both directions.
  throws?: readonly ErrorTypes[]
  // Method syntax gives bivariant parameter checking. Route handlers declare
  // specific input/output types, but definitions store them opaquely.
  // Runtime schema validation in applyMiddleware ensures type safety.
  handler(req: HttpRequest): Promise<HttpResult<unknown>>
  input?: RouteInput
  matcher: string
  middlewares?: readonly MiddlewareFunction[]
  operationId: string
  output: z.ZodType
  summary?: string
  tags: Tag[]
}

type GetRoute = BaseRoute & {
  method: 'GET'
  searchableColumns?: string[]
}

type BodyRoute = BaseRoute & {
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  // Multipart bodies reach the handler as `req.files`, not `req.body`, so they are
  // never run through `input.body` validation. This schema exists purely to describe
  // the form shape in the OpenAPI spec so generated clients accept a FormData payload.
  multipartBody?: z.ZodType
}

export type RouteDefinition = GetRoute | BodyRoute
