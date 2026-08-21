import type { z } from 'zod'
import type { HttpRequest, HttpResult } from '../../server/ports.js'

export type MiddlewareFunction = (req: HttpRequest) => HttpRequest | Promise<HttpRequest>

export type AuthPolicy = 'required' | 'optional' | 'unregistered' | 'public'

export function searchable<T>(...columns: Array<keyof T & string>): string[] {
  return columns
}

export const Tags = {
  AUTH: 'Auth',
  CARTS: 'Carts',
  CUSTOMERS: 'Customers',
  FULFILLMENTS: 'Fulfillments',
  FULFILLMENT_PROVIDERS: 'Fulfillment Providers',
  FULFILLMENT_SETS: 'Fulfillment Sets',
  PAYMENTS: 'Payments',
  PAYMENT_COLLECTIONS: 'Payment Collections',
  PRODUCTS: 'Products',
  PRODUCT_OPTIONS: 'Product Options',
  PRODUCT_VARIANTS: 'Product Variants',
  REFUND_REASONS: 'Refund Reasons',
  SHIPPING_OPTIONS: 'Shipping Options',
  SHIPPING_PROFILES: 'Shipping Profiles',
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
}

type BaseRoute = {
  auth?: AuthPolicy
  description?: string
  // Method syntax gives bivariant parameter checking. Route handlers declare
  // specific input/output types, but definitions store them opaquely.
  // Runtime schema validation in applyMiddleware ensures type safety.
  handler(req: HttpRequest): Promise<HttpResult<unknown>>
  input?: RouteInput
  matcher: string
  middlewares?: MiddlewareFunction[]
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
}

export type RouteDefinition = GetRoute | BodyRoute
